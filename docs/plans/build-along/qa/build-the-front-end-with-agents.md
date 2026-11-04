# QA: Build the front end with agents (course D, new), 2026-11-04

Role T: a fresh learner. The steel-man review (V) is in `../review/build-the-front-end-with-agents.md`.

## How it was checked

Course D is agent-driven: the learner prompts Claude Code, so a literal replay needs a live coding agent and, from D6, a GitHub OAuth app. Neither was available here. Each lesson was checked on paper instead:

- **The prompt:** does it name the goal, where to look, the constraints, plan-first and "done when"? Does it point the agent at the files and docs that produce the code at the tag?
- **"What to expect":** do the shown snippets come from the tag? `pnpm content snippets` checked all 52 tagged snippets in C+D against Klippy, with no errors.
- **The review checklist:** would it catch the usual misses before they reach the tag's code?
- **Steering:** does the lesson say what to do when the agent goes off course?

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | nit | D1 §2 | "It reads `CLAUDE.md`, or `AGENTS.md` when there's no `CLAUDE.md`" is accurate. A `CLAUDE.local.md` also counts as a memory file, though few beginners will have one. | Not changed; the lesson's `@AGENTS.md` tip covers the common case. |
| 2 | nit | D5 | It's the longest lesson (576 lines), because it carries the one full stylesheet (`stylesheet`, as decision 076 allows). It reads long on a phone, but D5 is `device: desk`. | Not changed. |
| 3 | nit | D1, D4, D5 | `lang="md"` and `lang="css"` snippets aren't highlighted (build warnings). | Not changed; it's cosmetic. A bits-side highlighter could add them later. |

No must-fix or should-fix items.

## Checked and fine

- **Steering:**
  - D2–D11 each have a "Steer prompts" block for the usual misses, quoting the miss and the one change.
  - D1 has the same in "Review it" (the file list, `npm` vs `pnpm`).
  - D10 teaches the habit: one change per prompt, then rerun.
- **Prompts:**
  - Every prompt uses the five parts D1 introduces.
  - Each points the agent at the right installed docs: remix `INDEX.md`, the agents and ai-chat docs, AI Elements' source.
  - Each prompt's constraints match what the tag's code does:
    - D5's service binding `AGENT` → `klippy`;
    - D6's numeric-id allowlist and `read:user` scope;
    - D7's bound `like()` search;
    - D9's token added only on the server side of the binding.
- **Review checklists:** each names what to reject (secrets in the client, string-built SQL, login checks by username, token in browser code), and these are exactly the drift a learner's agent would produce.
- **Outside steps:** the GitHub OAuth app steps (D6) are labelled as not recorded, and say where each value goes (`.dev.vars`, `wrangler secret put`).
- **The checkpoint:** D11's `:::verify` hits the web app's own `/klippy/check`. The d-11 web route exists (`check: { index: get('/klippy/check') }`, `TAG = 'd-11'`).
