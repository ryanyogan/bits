# 015. Auth: D1 sessions, email link + code, OAuth, cross-origin protection

Status: Accepted (2026-10-26). Supersedes the provisional parts of 011.

## Context

Milestone 3 replaces the fixture viewer (`getViewer(url)`, `?as=anon`) with
real accounts. The handoff asks for an email magic link and a 6-digit code,
GitHub and Google, Turnstile, rate limits, a `__Host-` session cookie and
CSRF protection. The user asked for the Remix 3 way with no JSON APIs unless
they are needed, Cloudflare primitives, and Cloudflare Email Sending (beta)
for mail.

## Decision

- **Sessions are `remix/session` backed by D1.** `app/auth/session.ts` has a
  custom `SessionStorage`. The cookie is `__Host-session`: signed with
  `SESSION_SECRET` (comma-separated for rotation), HttpOnly, Secure,
  SameSite=Lax, Path=/, 30 days. The `sessions` row is keyed by the
  **SHA-256 of the session id**, so a database leak gives no usable cookies.
  The row also holds the session data JSON, `user_id`, the user agent and
  `last_seen_at`. The storage never adopts an unknown id: a forged or stale
  cookie starts a new session (no fixation). `completeAuth` rotates the id
  at sign-in and keeps the data. A signed-in session renews itself once a
  day (`seenAt`).
- **Identity is `remix/middleware/auth`.** `loadAuth(db)` is a session
  scheme, and `context.auth.identity` is the D1 user. Use
  `requireUser()` (from `app/auth/identity.ts`) as controller middleware;
  signed-out visitors get a 303 to `/login?next=…`. `getViewer(context)`
  builds the AppBar `Viewer`. App code never reads the cookie directly.
- **Email sign-in = one email, two ways in.** `requestEmailSignIn` stores
  a row in `email_tokens` holding only hashes: `token_hash = sha256(token)`
  and `code_hash = sha256("code:" + token_hash + ":" + code)`, a 15-minute
  TTL, the sign-up answers (`signup` JSON) and `next`. Tokens are spent
  atomically with `UPDATE … WHERE used_at IS NULL … RETURNING`. A code
  locks after 5 wrong tries (the link still works). Limits: 3 emails per
  address per 10 minutes, 20 per IP per hour (`ip_hash`). Unknown emails
  create the account when verified: there are no passwords and no
  "user not found" leak.
- **The magic link is GET-confirm, POST-sign-in** (deviation from the
  handoff). Mail scanners and link previews follow GETs, so
  `GET /auth/verify?token=` only peeks and renders a "Continue as …"
  button, with `no-store` and `no-referrer`. The POST spends the token.
- **Mail is Cloudflare Email Sending** via the `send_email` binding `EMAIL`,
  sent from `Bits <signin@bits.yogan.dev>` (domain enabled with
  `wrangler email sending enable`). Outside production, `app/auth/mailer.ts`
  appends to an in-memory `outbox` (and logs `[mail]` in dev) instead of
  sending.
- **Turnstile** guards the two forms that send email (`/login`, and resend
  on `/login/check`). It is a small `TurnstileWidget` island with explicit
  render and `interaction-only`. Siteverify fails closed in production and
  checks `action` and the hostname (`TURNSTILE_HOSTNAMES`). Dev uses
  Cloudflare's always-pass test keys; tests skip it.
- **OAuth is `remix/auth`** (`startExternalAuth` / `finishExternalAuth`
  with PKCE and state in the session). Callback:
  `/auth/oauth/<provider>/callback`. The account rules
  (`userForOAuth`) are:
  1. a known identity signs in;
  2. if someone is signed in, the identity is linked to them, unless it
     belongs to another user (`taken`);
  3. otherwise, a provider-*verified* email matches an existing user;
  4. otherwise, a new user is created;
  5. with no verified email, the attempt is refused.
  A provider without credentials redirects to `/login?error=<p>-unavailable`.
- **CSRF: `remix/middleware/cop`, not tokens.** It does tokenless
  cross-origin protection from `Sec-Fetch-Site` and `Origin`, and runs
  before the session loads. `POST /webhooks/{provider}` is the only bypass.
  Together with SameSite=Lax, this is enough without hidden form tokens.
- **Authoring access.** `canManageCourse`: admins manage every course, and
  authors manage the courses that list them in `ownerIds`. Learners get the
  403 `ForbiddenPage`; unknown courses get a 404.
- **No new JSON endpoints.** Every auth step is a native form POST plus a
  303, or a GET page. The only non-HTML responses are the export download
  and the webhook stub.
- **Cleanup** runs in a daily cron (`17 4 * * *`, `scheduled()` in
  `worker.ts`), which deletes expired sessions and email tokens.
- **Tests sign in for real** (`app/test/auth.ts`: `signIn`, `fetchAs`,
  `requestCode`). `remix test` runs `before`/`after` around *every*
  `describe`, so a file that uses D1 keeps one flat `describe` with
  `after(() => disposePlatform())` inside it. Otherwise Miniflare is
  disposed between suites ("poisoned stub").

## Consequences

- Production needs these before deploy:
  - `pnpm db:migrate:remote` (0002);
  - `wrangler secret put SESSION_SECRET`;
  - a Turnstile widget (`TURNSTILE_SITE_KEY` var and `TURNSTILE_SECRET_KEY`
    secret). Without it, email sign-in fails closed.
- GitHub and Google stay "not switched on yet" until their OAuth apps exist
  and the four client secrets are set.
- Not built yet:
  - passkeys (the button explains this);
  - changing your email (`saved=email-unavailable`);
  - streaks on the Viewer (always 0).
- `?as=anon` and `getViewer(url)` are gone. To see signed-out pages, sign
  out, or use a private window.
