# QA: Your first agent loop (course C, rebuilt on Klippy), 2026-11-04

Role T: a fresh learner. The steel-man review (V) is in `../review/first-agent-loop.md`.

## How it was checked

- **Literal replay of C3 and C4** in a scratch folder.
  - I started from `git archive` of Klippy `c-02`.
  - Every file was built from the lesson's snippets and prose, by scripts that paste only what the lesson shows.
  - Then I ran `pnpm install`, `pnpm typecheck` and `pnpm exec vitest run`.
  - I ran `wrangler dev` on port 8810 and drove `/agents/klippy/<name>` over HTTP and WebSocket.
  - With no Anthropic key, live replies were not exercised; the 401 and lock paths were.
  - All processes were killed afterwards.
- **C5–C9:** each tag diff's file list (`c-04..c-09`) was compared with what the lesson tells the learner to touch. Test folders are copied from the tags, as each lesson says.
- **C1 and C2:** concept and planning lessons, read.
- **Links:** every external link resolves (Klippy tags 200 now the repo is public), apart from the expected 405s from MCP endpoints.

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | must | C3 §2 | `agent.ts` was shown as the class and its method only, with no imports. A literal learner's typecheck fails: `Cannot find name 'AIChatAgent'`, and the same for `streamText`, `MAX_QUESTION`, `underLimit`, `model`, `getTime` and `getWeather`. | Added a tagged `c-03` snippet of the seven import lines (lines 1–7 of the file) before the class. |
| 2 | should | C3 §0 | "Delete the `"loop": …` line" leaves a trailing comma on the `"typecheck"` line. Then `pnpm` fails with `ERR_PNPM_JSON_PARSE`. Reproduced. | Said to delete the comma it leaves on the line above. |
| 3 | should | C3 §1 | `pnpm run cf-typegen` came straight after the wrangler edits, before `index.ts` exports `Klippy`. It then types `env.Klippy` as a bare `DurableObjectNamespace`, and the tests' typecheck fails. Run after the export, it gives `DurableObjectNamespace<import("./src/index").Klippy>`. Reproduced. | Moved the instruction to step 4, after the export, with the reason. |
| 4 | nit | C3 §4 | The `/agents/` block had no placement. | Said "right after the `/` route". |
| 5 | nit | C6, C7 | "replace the file with the cNN version" for larger files borders on copy-all. It's acceptable for test and fixture files, which aren't the lesson's idea. | Not changed. |
| 6 | nit | C9 | "all 64 tests should pass" can flake on the rate-limit test at the tags (fixed only on Klippy main). | Not changed in the lesson; listed for Klippy. |

After fixes 1–3, the C3 replay typechecks and `agent.spec.ts` passes. C4 replayed clean: `pnpm chat alice` connects, and a wrong token gets the 401 message.

## Checked and fine

- C4–C9 name every file their tag changes, apart from the test folders they tell you to copy.
- Each lesson ends with something to run (a terminal check, a quiz or the `:::verify` deploy check).
- Build lessons are `device: desk`, `verified: 2026-11-03`, with exact `versions:`.
