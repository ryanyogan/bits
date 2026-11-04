# QA: Ship an agent to the edge (course F), fresh-learner pass

2026-11-03. Klippy tags `e-09` and `f-01` … `f-08` (github.com/ryanyogan/klippy),
cloned into a scratch directory. Local only: no Cloudflare resources, no
deploys, no `wrangler dev` (nothing listened on a port).

## How it was run

- **Lessons 01–05, by diff, with typecheck proofs.** For each lesson, the
  tag's diff (`git diff <prev> <tag> -- . ':!docs'`) was compared line by line
  with what the lesson shows or tells the learner to copy. This was not a
  full literal replay, where every file is rebuilt from the snippets. Instead,
  each gap was proven: in a frozen-install clone, the tag was checked out,
  only the file or lines the lesson never mentions were put back to the
  previous tag, and `pnpm typecheck` was run. All five lessons failed as
  shipped:
  - 01: notes controller left at `e-09` →
    `controller.tsx(24,27): error TS2322 … sent: boolean`
  - 02: `ask.ts` left at `f-01` → `check.ts(28,80): error TS2554: Expected 2-3 arguments, but got 4.`
  - 03: agent `worker-configuration.d.ts` not regenerated →
    `budget.ts(23,44): error TS2344: Type '"DAILY_TOKEN_BUDGET"' does not satisfy the constraint 'keyof Env'.`
  - 04: `budget.ts` left at `f-03` (the lesson never said to change it) →
    `agent.ts(4,23): error TS2305: Module '"./budget"' has no exported member 'estimateTokens'.`
  - 05: the `fixed` and `reservations` lines never shown →
    `agent.ts(79,5): error TS2304: Cannot find name 'reservations'.`
  Each tag's own baseline typecheck is clean. Tests weren't re-run (the
  memory budget was tight). The recorded results are agent 96 / 98 / 101 /
  106 / 111, plus clean-worktree runs of f-01 … f-07 in f-08.txt.
- **Lessons 06–08.** The `f-05..f-08` diffs were compared with the lessons
  (CI, wrangler config, `agent.ts` guard, `TAG`).
- **Recorded blocks.** Every `:::terminal` was checked against
  `docs/outputs/f-0N.txt`.
- **`:::verify` (lesson 08)** was checked against the web
  `/klippy/check` controller and the agent's `check.ts` at `f-08`:
  - the nonce `bits-checkpoint-f08` fits `^[A-Za-z0-9_-]{8,64}$`;
  - the reply is `{nonce, tag, probe}` with `tag: 'f-08'`;
  - the hints for a 503 (Preview, no `AGENT`) and a 429 (`CHECK_LIMITER`)
    match the code.

## Stuck points (all fixed in the course folder)

| # | Lesson | Severity | What a learner hits | Fix |
|---|---|---|---|---|
| 1 | 01 | must | `NotesPage` now requires `sent`, but the notes controller change isn't shown. Typecheck fails. | Controller snippet (`sent` from the query, passed on) |
| 2 | 01 | should | Without `;type=text/markdown`, curl sends `.md` as octet-stream and gets 415. That is recorded, but the lesson doesn't say it. | One sentence on it |
| 3 | 01 | should | The upload sends `pip.md`, but the search shows title `pip-f01.md` (as recorded). A learner sees `pip.md`. | Says yours will read `pip.md`, and that ours is left as recorded |
| 4 | 02 | must | The changes to `model()`, `contextModel`, the `ask()` signature and call, and `note.ts` are only described. `check.ts`'s 4-argument `ask()` fails typecheck. | Three snippets |
| 5 | 03 | must | The agent's `DAILY_TOKEN_BUDGET` var needs `cf-typegen` in `apps/agent`. The lesson only says `apps/web`. | Step added |
| 6 | 03 | must | `agent.ts` has no `import { dailyBudget, spend, tokensToday } from './budget'` | Import snippet |
| 7 | 04 | must | `estimateTokens` (`budget.ts`), the new imports, `MAX_OUTPUT`, `started`, the `logRefused` calls, and moving `system`/`messages` out of `streamText` aren't shown. Typecheck fails. | Snippets plus one paragraph |
| 8 | 04 | should | Block labels `… WHERE event = 'turn'` aren't the real SQL. The recorded inline curl commands don't survive bash quoting (`'$[0]…'` closes the single-quoted string). | A here-doc command with the real SQL, labelled as written for the lesson; the labels say they're shortened |
| 9 | 05 | must | `fixed`, `reservations`, the new import, and removing `onStepStart` aren't shown. Lesson 4's `const reserve` would also shadow the imported `reserve()`. | Two snippets plus a "delete `onStepStart`" line |
| 10 | 06–08 | — | No stuck points. The CI job, previews block, `agentFetch` guard and `TAG` match their tags, as do the copy links. | — |
