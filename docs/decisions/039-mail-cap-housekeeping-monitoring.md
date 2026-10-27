# 039. A daily mail cap, one housekeeping batch, and error logs worth alerting on

Status: Accepted (2026-10-27). Follows 015 (auth), 019 (live prompts),
020 (production hardening), 029 (video) and 030 (email change).

## Context

- **Mail.** Sign-in mail was limited per address (3 per 10 minutes) and per
  IP (20 per hour), counted from `email_tokens`, plus the `RL_SIGNIN`
  burst limiter. Nothing bounded the total. A sender spread over many IPs
  and addresses could send mail without limit: past Email Sending's
  included 3,000 a month (then $0.35 per 1,000, Workers Paid, checked
  2026-10-27), and to strangers, which costs the domain its reputation.
- **Cleanup.** A daily cron already deleted expired sessions, email tokens,
  WebAuthn challenges and old signed-out runs, in two separate writes.
  Video uploads that never finished stayed `uploading` for good.
- **Errors.** `worker.ts` logged a thrown error with the full URL. Query
  strings carry magic-link tokens, email-change tokens and
  `/login/check?email=`, and Workers Logs' own invocation logs did too.
  A handler that returned a 5xx (a 503 from `/health`) logged nothing at
  the request level, and nothing carried a request id.

## Decision

### A global daily cap, reserved by the write

- `mail_quota` (migration 0009): one row per UTC day, `sent` and
  `capped_at`. `reserveMailSend` (`packages/db/src/queries/mail.ts`) is
  one upsert that adds 1 only while `sent < cap`
  (`insert … select … where ?cap > 0 on conflict (day) do update set
  sent = sent + 1 where sent < ?cap`). D1 runs statements one at a time,
  so parallel requests can't both take the last slot. Same rule as
  `insertRunWithin` (019): reserve with the write, never count and then
  send. Tested with 20 parallel requests against a cap of 5.
- The cap is the `SIGNIN_MAIL_DAILY_CAP` var (300 by default, in
  `wrangler.jsonc` and the `previews` block). 300 a day is far above real
  use, and it bounds a distributed burst to a few dollars and one bad day.
- `reserveMail()` (`app/auth/mail-quota.ts`) runs after the per-address
  and per-IP checks, so a request those refuse costs no slot, and before
  the token is stored or the email sent. It covers every email someone
  can ask for: sign-in, the Settings step-up code (both
  `requestEmailSignIn`) and the confirm-new-address code
  (`requestEmailChange`). The "your email was changed" notice to the old
  address isn't capped. It only follows a confirmed code, which was.
  `mailer.ts` is unchanged.
- Past the cap, `/login` re-renders with a 429 (a 4xx, so client
  navigation renders it) and a calm warning: "We've sent all the email we
  can for today. Use a passkey, GitHub or Google instead, or try email
  again tomorrow." The passkey and provider buttons sit right under it.
  Email change shows the same text on its field.
- The first refusal of the day stamps `capped_at`, and that request alone
  logs `log('error', 'Daily mail cap reached', { cap, purpose })`. That's
  one error per crossing, which opens a Workers Issue (below). Raising the
  var mid-day doesn't log a second crossing on the same day.

### Housekeeping: one batch, a summary line

`runHousekeeping()` (`app/housekeeping/housekeeping.ts`) is the cron's
work. `worker.ts`'s `scheduled` handler passes it the bindings and
`controller.scheduledTime`; tests call it directly on the test platform's
real D1 and R2.

1. It lists `uploading` videos older than 7 days and aborts their R2
   multipart uploads (`resumeMultipartUpload(key, id).abort()`, settled,
   not awaited one by one). R2 aborts them itself after 7 days, and the
   docs warn the upload may already be gone, so a failed abort is fine.
2. It runs one `db.batch` (`deleteExpiredRows`, `packages/db/src/queries/housekeeping.ts`):
   - sessions past `expires_at`;
   - email tokens an hour after they expired or were spent (the
     per-address and per-IP limits count the last hour; the email-change
     batches check spent tokens only inside their own batch);
   - WebAuthn challenges past `expires_at`;
   - signed-out runs older than 7 days (019);
   - `mail_quota` rows older than 30 days;
   - stale `uploading` videos set to `failed` with no `upload_id`. The row
     stays, because its `r2_key` is never reused.
3. It logs one line, `Housekeeping finished`, with the count per table, or
   `Housekeeping failed` at error level, and rethrows so the invocation
   shows as failed.

These tables have nothing that expires: users, identities, passkeys,
progress, XP, activity, badges, courses and their versions, course
authors, drafts, and ready or failed videos. Account deletion cascades.

The cron is unchanged (`17 4 * * *`). To check it under workerd:
`pnpm build`, then `wrangler dev --test-scheduled`, then `curl
"http://localhost:<port>/cdn-cgi/local/scheduled?cron=17+4+*+*+*&format=json"`.
The route is now `/cdn-cgi/local/scheduled`, not the older `/__scheduled`.

### Error logs: once per 5xx, with a ray id, without secrets

- `logServerErrors()` (`app/middleware/server-errors.ts`) is the second
  router middleware, inside `responseHeaders()`:
  - When an action or middleware throws, it logs `Unhandled request error`
    and answers a plain `500` with `no-store`, which still gets the
    security headers.
  - When a handler returns a 5xx, it logs `Server error response`.
  - When the client aborted, it logs at info and answers 499.
  Each log line carries `method`, `path`, `status`, `ms` and `rayId`
  (`cf-ray`, the id Cloudflare's request logs use). It never logs the
  query string.
- `errorFields()` replaces anything shaped like an email address in the
  message and stack with `[email]`. `requestFields()` is the one helper
  that turns a request into log fields.
- `worker.ts` keeps a last catch for throws outside the router's inner
  middleware, with the same fields.
- Streaming render failures are still logged by `render({ onError })`.

### Observability config

- `observability.redact_query_string: true`, in production and in the
  previews block. Workers Logs and traces then record request URLs without
  their query strings, so tokens and addresses stay out of the
  dashboard's logs.
- Logs stay at `head_sampling_rate: 1`. At this traffic, every request is
  well inside the included log events: 20M a month on Workers Paid (7-day
  retention), or 200k a day on Free (3 days). From 2026-12-01, Workers
  Logs move to Cloudflare Observability pricing (per GB ingested, with
  queries and alerts free). Revisit the rate if the bill shows logs.
  Traces stay at 0.1.
- `observability.issues.enabled: true` turns on Workers Issues (needs
  wrangler 4.134 or later; 4.152 is installed). It's in open beta and free.
  It groups uncaught exceptions, failed invocations, 5xx responses and
  `error`-level logs into issues. That's why `error` is reserved for
  things the owner should look at.

### Alerting the owner (dashboard, not code)

Checked against Cloudflare's docs on 2026-10-27. None of this is set up
from code. Owner steps:

1. **Workers Issues automation** (free, beta). Go to Workers & Pages →
   bits → Issues → Automations → Add automation. Choose an occurrence
   threshold (for example 5) or "recurrence after inactivity", and an
   email or webhook destination. This covers uncaught errors, 5xx
   responses, `Daily mail cap reached` and `Housekeeping failed`. The
   Cloudflare CLI (`cf`) can configure the same thing, but we don't run it
   from CI.
2. **Alerts → Monitors** (Observability → Alerts). A monitor runs a SQL
   query on a schedule and notifies by email, webhook or PagerDuty, on a
   threshold, an anomaly or an SLO. Suggested monitors:
   - Worker error rate: anomaly detection on errors over requests for
     script `bits`;
   - a threshold on `Daily mail cap reached` log lines (more than 0 in 24
     hours);
   - an SLO on `/health` being 2xx.
   Cloudflare says alerts carry no extra charge under the new pricing.
3. **Usage.** Set billing and usage notifications in Notifications for
   Workers and D1 usage, so a runaway loop shows before the invoice. The
   2022 "Workers Usage Report / Weekly Summary" emails are disabled.
4. **Uptime for `https://bits.yogan.dev/health`.** Cloudflare's standalone
   Health Checks need a Pro zone or above (Free: 0 checks; Pro: 10). On a
   Free zone, rely on the Issues automation and a Monitor, or use a free
   external pinger.
5. **Optional, cheap:** an R2 lifecycle rule as a second backstop for
   unfinished uploads (`wrangler r2 bucket lifecycle add bits-content
   abort-mpu videos/ --abort-multipart-days 7`). R2 aborts them after 7
   days already.

## Consequences

- Run `pnpm db:migrate:remote` (0009) before deploying, or let CI do it,
  since migrations run before the code. The migration is additive.
- At most 300 requested emails a day go out. On the day it trips, email
  sign-in shows the warning until 00:00 UTC. To raise or lower the cap,
  change the var and deploy.
- Housekeeping cuts a little more data: spent tokens go an hour after use
  instead of an hour after expiry, and stuck uploads close. `/privacy`
  already describes the clean-up and the request logs (paths, status
  codes and errors), so its text and date are unchanged.
- Not done: `/health?deep=1` (an R2 head next to the D1 probe). `/health`
  already does a D1 round trip, which is what CI's smoke test needs. It
  would also mean editing the root controller and adding a rate-limit
  tier for a little more signal. Add it if R2 outages ever go unnoticed.
