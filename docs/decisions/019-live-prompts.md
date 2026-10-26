# 019. Live prompts: /api/run through AI Gateway, journalled runs, honest temperatures

Status: Accepted (2026-10-26). Completes the `run` follow-up in 016.

## Context

Milestone 4 is done when:
- the 11th anonymous run within an hour falls back to the example output;
- the AI Gateway shows a spend cap.

The handoff asks for `POST /api/run`, streamed, through Cloudflare AI Gateway
to a small model, with limits, a canned fallback and a prompt journal
(`exercise_attempts`). Decision 016 left "ran at 0 and 1.0" as the browser's
claim, to be replaced by server-counted runs.

Two API facts shape the design:
- The current Messages API rejects `temperature`, `top_p` and `top_k` on
  every model (400). Claude samples at temperature 1.0.
- The Temperature lesson asks learners to run at 0 and at 1.0.

## Decision

- **Model: Claude Haiku 5.5 (`claude-haiku-5-5`) through AI Gateway's
  Anthropic endpoint**, called with the official `@anthropic-ai/sdk`
  (`baseURL` = `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/anthropic`).
  Each call is kept small: a two-sentence system prompt ("you are the model
  in a teaching sandbox, answer briefly"), the learner's prompt as the user
  message (4,000 characters at most), `max_tokens: 300`,
  `output_config: { effort: 'low' }`, `thinking: { type: 'disabled' }`,
  no retries, a 20 s timeout. No sampling parameters are sent.
- **Honest temperatures.** Only T=1.0 runs live, because that is what Claude
  really does. Other temperatures (0, 0.7) return the lesson's `- example`
  outputs, labelled "example output" with a note that this temperature
  doesn't run live. Both kinds go through `/api/run` and are journalled
  (`source` = `live` or `example`), so the server can verify "ran at 0 and
  1.0". Prompting for determinism ("always answer the same way") was
  rejected: it would teach the wrong mechanism.
- **One provider seam: `app/runs/model.ts`.** It exports `runModel({ prompt,
  temperature, signal, env }) → { stream: ReadableStream<string>, model,
  usage: Promise<{ input, output }> }`, `liveTemperatures` / `runsLive(t)`,
  and `ModelError` (`unconfigured`, `rate-limited`, `unavailable`, mapped
  from the SDK's typed errors). `runModel` resolves only after the provider
  accepts the request, so failures surface before any text is sent.
  `/api/run`, the limits, the journal and the fallback (`app/runs/run.ts`)
  import only that module; nothing else imports the SDK, and neither the
  controller nor the islands know which temperatures are live. A later
  option: route non-1.0 temperatures to a Workers AI open model (the `AI`
  binding, same gateway) by adding them to `liveTemperatures` and a second
  branch in `runModel`. Not built now.
- **Streaming: plain text.** The response is `text/plain`, streamed; headers
  say what it is: `X-Run-Source` (`live` | `example` | `fallback`),
  `X-Run-Reason` for a fallback (`limit` | `budget` | `unconfigured` |
  `rate-limited` | `unavailable`), `X-Run-Model`. All responses are
  `Cache-Control: no-store`; errors are JSON (422 invalid, 404 unknown
  exercise, 429 refused). The request is a same-origin `FormData` POST, so
  `cop` and the `formData` middleware apply unchanged. The browser helper
  (`packages/ui/src/lib/run-stream.ts`) is shared by the PromptComposer and
  the Terminal prompt; a rerun aborts the fetch in flight, which cancels the
  response stream, which aborts the provider request.
- **The journal: one `exercise_attempts` row per run** (migration 0005
  rebuilds the table: `user_id` becomes nullable, plus `visitor`, `ip_hash`,
  `source`, `temperature`, `output` (2,000 chars), `model`, token counts).
  "Complete lesson" still writes one `source = 'submit'` row per exercise.
  A live row is reserved before the model is called (see 020; an aborted
  run still counts) and finished with the output and exact token counts
  when the stream ends, or in `platform.waitUntil` if the browser goes away.
- **Signed-out runs** are keyed by a random `visitor` id kept in the session
  (the session is a D1 row; data survives the sign-in id rotation). At
  sign-in `mergeAnonymousProgress` moves the visitor's runs to the user.
  The daily cron deletes signed-out runs older than 7 days.
- **The run check counts the journal.** `completeLesson` fills
  `submission.ran` from the viewer's journalled runs (any source) and never
  reads `ran.*` fields; the composer no longer sends them. For a signed-out
  completion the journal-derived `ran` is stored in the session, so the
  merge at sign-in doesn't depend on runs that the cron may have pruned.
- **Limits, counted exactly from D1** (indexed per user, per visitor, per IP
  and for live rows by time). Every run counts, live or canned:
  - signed out: 10 per hour per session, 30 per hour per IP (clearing cookies
    doesn't buy more);
  - signed in: 60 per hour, 300 per day;
  - everyone: `RUN_DAILY_LIVE_CAP` live runs per UTC day (var, default
    1000), the spend guard inside the app.

  Over a limit the run is canned (`fallback`, reason `limit` or `budget`)
  and still journalled, so the learner can keep going and still pass the
  run check. Past three times the hourly limit, runs are refused (429, not
  journalled) so the journal can't be flooded. The Rate Limiting binding
  was not needed: D1 counts are exact, testable locally and already
  per-session; it remains the option for a per-IP burst limit.
- **Fallback for everything else**: no key configured (local dev and tests),
  the gateway or Anthropic rate limiting, auth or network errors. The UI
  shows the example output with a one-line note (`ModelOutput` gained a
  `note` prop).
- **Secrets and config.** Secrets: `ANTHROPIC_API_KEY` (the key the
  gateway forwards) and `CF_AIG_TOKEN` (Authenticated Gateway token, sent
  as `cf-aig-authorization`). Vars: `AI_GATEWAY_ACCOUNT_ID`,
  `AI_GATEWAY_ID` (`bits`), `RUN_DAILY_LIVE_CAP`. Live runs need the key
  and both ids. Gateway BYOK (the key stored in the gateway) would leave
  only `CF_AIG_TOKEN` in the Worker. Cloudflare documents that token as
  account-scoped (it can use every gateway's stored keys), so the Worker
  secret was kept for now.
- **Workers bundle.** The SDK keeps Node built-ins in `node.mjs` modules
  that its `browser` field swaps for throwing shims; `scripts/build.ts`
  applies that swap (esbuild honours `browser` maps only for platform
  "browser"), so the Worker still has no `node:` imports and no
  `nodejs_compat`. The SDK adds about 340 KiB minified. SDK 1.x sends the
  key as `Authorization: Bearer`; `x-api-key` is also sent, as the
  gateway's Anthropic docs show.

## Consequences

- Cost per live run is tiny: about 60 system + 20–100 prompt tokens in, and
  15–60 out for a tagline (300 max). At $0.10 / $0.50 per MTok that is
  roughly $0.00003 a run, and at most about $0.0002 at the cap. The default
  daily cap of 1,000 live runs is worst case about $0.20 a day.
- The gateway's spend cap is set in the dashboard (or API), not in code. It
  is the backstop if the in-app cap is misconfigured.
- Token counts on screen are still the composer's estimate; exact counts
  are in the journal (and the settings export, now version 2).
- ~~Limits can be overshot by a few runs under concurrency (count, then
  insert).~~ Fixed in 020: the limits are enforced by the insert. A live
  run first reserves its row with one `INSERT … SELECT … WHERE count < cap`
  statement (`insertRunWithin`) covering the owner's, the IP's and the
  daily live caps; only a reserved run calls `runModel`. Until the stream
  ends the row is `live` with no `model` (in flight); a failed model call
  turns it into `fallback`. Canned rows are written the same way below the
  refusal caps, so parallel requests can't pass any of them.
- `PromptBlock.model` (a per-exercise model override in the handoff) is not
  honoured yet: every live run uses Haiku 5.5.
- Not done: Gateway caching (it would make T=1.0 deterministic, which is
  wrong for this lesson), per-IP burst limits, a "live" marker on the
  temperature picker.
