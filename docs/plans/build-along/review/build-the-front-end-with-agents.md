# Review: Build the front end with agents (course D, new), 2026-11-04

Role V: steel-man. The fresh-learner check (T) is in `../qa/build-the-front-end-with-agents.md`.

## How it was checked

- **Accuracy:**
  - **Claude Code memory** (`CLAUDE.md`, `AGENTS.md`, `@` imports, plan mode `--permission-mode plan`): checked against code.claude.com/docs/en/memory (Firecrawl, maxAge 0, 2026-11-04).
  - **The Cloudflare docs MCP URL** (`docs.mcp.cloudflare.com/mcp`): checked. D3's `agents.cloudflare.com/mcp` is a deliberate wrong-URL example, with the steer to the right one.
  - **AI Elements:** Apache-2.0, by Vercel. D8 credits it and copies only what the lesson adapts.
  - **Service bindings and remix/auth GitHub sign-in:** PKCE and `read:user`, checked against the installed remix 3.1 docs and the code at d-05..d-06.
- **Honesty:**
  - course.md and D1 say the code at each tag was written by an agent from the lesson's prompt, not recorded from a fresh run.
  - D10's review says it's "a real run, quoted". Klippy's `d-10:docs/outputs/d-10.txt` records it: a real headless `claude -p` run in plan mode, 2026-11-03. The quoted headlines match it.
- **`:::verify`:** checked against Klippy `d-11` (the web app's check route).
- **Coach eval:** `coach:eval --course build-the-front-end-with-agents` scored 15/15 (100%), 0 unusable verdicts.
- **Build checks:** `pnpm content validate` (0 errors, 3 highlight warnings) and `pnpm content snippets` (clean).

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | nit | D1 §2 | It could also mention that `CLAUDE.local.md` is read. | Not changed (see qa #1). |

No must-fix or should-fix items on accuracy, security or honesty.

## Checked and fine

- **The numeric-id allowlist (D6):**
  - It uses GitHub's numeric user id (`gh api user --jq .id`), not the login, which can be renamed and reclaimed.
  - It's checked in the OAuth callback and again on every request.
  - The lesson doesn't claim more: the allowlist decides who reaches the app, and the agent's own token check stays.
- **The token (D6, D9):**
  - `KLIPPY_TOKEN` lives only in the web Worker's secrets and is added on the server side of the service binding.
  - The browser never sees it, and the agent re-checks it.
  - D10's review confirms an exact `Origin` match on `/chat`.
- **Links from model output (D8, D9):** limited to `^https?://`, as the lesson says.
- **Format:**
  - Every lesson is ≤ 30 minutes.
  - Snippets are ≤ 30 lines and highlight ≤ 15.
  - `stylesheet` is used once, for D5's full stylesheet, as decision 076 allows.
- **`:::verify` (D11):**
  - It uses `/klippy/check?nonce=bits-checkpoint-d11` and expects the keys `nonce`, `tag` and `probe`.
  - Its tag regex `(d-11|[e-g]-\d\d)` matches the d-11 route and its `TAG = 'd-11'`, and later tags still pass.
