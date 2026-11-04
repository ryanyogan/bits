# QA: Retrieval without tears (course E), fresh-learner replay

2026-11-03. Klippy tags `e-01` … `e-09` (github.com/ryanyogan/klippy), with local
doubles only: no Cloudflare resources, no deploys, no `wrangler dev`.

## How it was run

- **Lesson 02, literally.** Starting from `e-01` (`pnpm install --frozen-lockfile`,
  baseline typecheck clean), every file the lesson says to create was written
  from its snippets, word for word. Every "copy from the tag" file was copied.
  The shipped lesson failed typecheck:
  `src/ingest/workflow.ts(24,1): error TS1005: '}' expected`. After the fixes,
  the same literal replay gives a clean typecheck and `15 files, 71 tests
  passed`, the lesson's own number.
- **Lessons 03–05, together.** Files the lessons say to create were composed
  from their snippets only (`chunk.ts`, `rrf.ts`, `vectors.ts`, `search.ts`),
  on top of the tag's copied tests and migrations. Files the lessons edit in
  place (`workflow.ts`, `agent.ts`, `sources.ts`) were checked line by line
  against `git diff e-02 e-05`. After the fixes: clean typecheck and `18
  files, 83 tests passed`, the lesson's number.
- **Lessons 06–09.** Each tag's diff was compared with what the lesson shows
  or tells the learner to copy.
- Every `:::terminal` command and output line was checked against
  `docs/outputs/e-*.txt` with a script. After the fixes, all are verbatim.

## Stuck points (all fixed in the course folder)

| # | Lesson | Severity | What a learner hits | Fix |
|---|---|---|---|---|
| 1 | 02 | must | `workflow.ts` snippet has no imports, no `IngestParams`, and no closing `}` `}`. Typecheck fails. | Imports + type snippet, then the full class |
| 2 | 02 | must | `src/ingest/read.ts` (`readLinkAsMarkdown`) is used but never created | Full 10-line snippet |
| 3 | 02 | must | `tools/sources.ts` "Create" snippet has no imports (`tool`, `z`, `Klippy`, `queueSource`, `linksIn`) | Whole file shown |
| 4 | 02 | must | `linksIn` must be exported, mentioned only in passing | Explicit step plus a one-line snippet |
| 5 | 02 | must | `agent.ts` uses `saveLinkTool`, `queueSource` and `fileToMarkdown` with no import step | Imports snippet |
| 6 | 02 | should | The `sources` table in `packages/db` was only a diff link | Snippet |
| 7 | 03 | must | `chunk.ts` snippet ends without the function's `}` | Added |
| 8 | 03 | must | `workflow.ts` needs `chunk` and `saveChunks` imports, plus `let body` and `body = page.body`, which are only described | Imports snippet; the whole `try` block |
| 9 | 03 | nit | Bare `wrangler d1 execute` (as recorded) fails without a global wrangler | Note: `pnpm exec wrangler …` in `apps/agent` |
| 10 | 04 | must | `workflow.ts` needs `import { type ChunkRow, upsertChunks }` | Snippet |
| 11 | 05 | must | `search.ts` "Create" snippet has no `rrf` or `vectorSearch` imports, and the `Hit` type is never shown | Imports and `Hit` added to the snippets |
| 12 | 05 | must | The FTS migration was elided with `...`, so the delete and update triggers had to be fetched | Full 15-line migration, plus a line on FTS5's `'delete'` command |
| 13 | 05 | must | The `/search` route was "copy it from the tag", but `agent.ts` is a file the learner edits | Route snippet + import |
| 14 | 05 | nit | `jq` is assumed | Note: optional |
| 15 | 06 | must | The `'embed'` step's `SELECT` must add `context`. The lesson never says so, and without it the vectors silently leave out the context. | Explicit bullet + `vectors.ts` snippet |
| 16 | 06 | must | `context.ts` "Create" snippet has no imports or caps (`MAX_DOCUMENT`, `MAX_CONTEXT`) | Now "copy the file", with the snippet as the part that matters |
| 17 | 06 | should | `createAnthropic` import and `contextFor` import never mentioned | One line each |
| 18 | 06 | should | "Add `context` to the `chunks` table in packages/db", but the learner never created that table (nothing imports it) | Marked optional |
| 19 | 07 | must | `Hit` needs `context`, and `hydrate` must select `c.context`. Otherwise `rerank.ts` fails typecheck (`hit.context`). | New step with snippet |
| 20 | 07 | must | `rerank.ts` and `tools/search.ts` "Create" snippets have no imports | Imports shown |
| 21 | 07 | should | `searchNotesTool` import; the web `message.tsx` was never mentioned | Import line; copy step for `sources.tsx` + `message.tsx` |
| 22 | 08 | should | `recall.spec.ts` needs `recall.ts` (and the eval needs `corpus.ts`), but the lesson said to copy the eval files only at `e-09` | Copy `corpus.ts` and create `recall.ts` now. Both are safe and unchanged at `e-09`. |
| 23 | 09 | must | The `eval:retrieval` script was added at `e-08`, but no lesson tells the learner to add it, so `pnpm eval:retrieval` fails | Script line in lesson 9 |

Tests: every lesson's copy-tests step matches the tag's test changes
(`approval.spec.ts` at e-05 included).
