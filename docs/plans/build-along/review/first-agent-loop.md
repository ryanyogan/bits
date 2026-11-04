# Review: Your first agent loop (course C, rebuilt on Klippy), 2026-11-04

Role V: steel-man. The fresh-learner replay (T) is in `../qa/first-agent-loop.md`.

## How it was checked

- **Accuracy:**
  - `AIChatAgent`, `maxPersistedMessages`, `routeAgentRequest`, `schedule`, `waitUntilStable` and `saveMessages` were checked against the installed docs of `agents@0.33.0` and `@cloudflare/ai-chat@0.12.2`.
  - `streamText`, `isStepCount`, `prepareStep`, `activeTools` and `toolChoice: 'none'` were checked against `ai@7.0.162`.
  - Durable Object migrations (`new_sqlite_classes`) and the WebSocket-auth advice were checked against Cloudflare's docs (Firecrawl, maxAge 0, 2026-11-04).
- **Security asides** were checked against the code at each tag.
- **`:::verify`** was checked against Klippy `c-09:apps/agent/src/check.ts`.
- **Coach eval:** `coach:eval --course first-agent-loop` scored 30/30 (100%), 0 unusable verdicts.
- **Build checks:** `pnpm content validate` (0 errors, 0 warnings) and `pnpm content snippets` against Klippy (clean).

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | nit | C9 §test | The 64-test count includes the rate-limit test, which can flake at the tag. | Klippy-side: back-port main's fix to the tags, or have the lesson say "64 tests (re-run once if the rate-limit test times out)". Left for the owner. |

No must-fix or should-fix items on accuracy, security or honesty.

## Checked and fine

- **The query token (C3 §5):** the lesson doesn't overclaim.
  - It allows `?token=` only on a WebSocket upgrade, and deletes it before the agent sees it.
  - It says plainly that the opening request's URL still carries the token and that Workers Logs record it.
  - It advises a long random token and rotation, and names short-lived signed tokens as Cloudflare's recommendation.
- **The page cut (C7):**
  - The three locks are described as what they are.
  - The exact-link check and no redirects are the guarantee.
  - The `activeTools` cut is defence in depth.
  - The tools refuse outright after an untrusted read.
  - It says plainly that calls in the same step still run.
- **Nudge limits (C8):**
  - Nudge turns build no tools and are marked `metadata.nudge`.
  - They're capped at 10 waiting and 20 a day.
  - Each spends the owner's budget, and the lesson says so.
- **Honesty:**
  - Recorded replies are labelled with the model that gave them (the Workers AI fallback where no Claude key was used).
  - The deploy output is a labelled dry run.
- **`:::verify` (C9):**
  - It uses `/klippy/check?nonce=bits-checkpoint-c09`.
  - Its regexes are `"nonce"\s?:\s?"bits-checkpoint-c09"` and `"tag"\s?:\s?"(c-09|[d-g]-\d\d)"`.
  - Both match the response shape and `TAG = 'c-09'` in check.ts, and later tags still pass.
- **Format:**
  - Every tagged snippet is ≤ 30 lines and highlights ≤ 15.
  - No lesson is over 30 minutes.
  - The new C3 imports snippet is 7 lines, matched by the snippet check.
