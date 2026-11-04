# Review: Retrieval without tears (course E), steel-man pass

2026-11-03. Every doc was fetched live with Firecrawl (`maxAge: 0`) on that day.

## Accuracy

| Claim | Source (fetched 2026-11-03) | Verdict |
|---|---|---|
| `AgentWorkflow<Agent, Params>` from `agents/workflows`, `this.runWorkflow('BINDING', params)` | developers.cloudflare.com/agents/agent-class/run-workflows/ | ✓ The old `/agents/api-reference/run-workflows/` URL redirects; updated (should) |
| Vectorize: create the metadata index **before** inserting vectors; string type | developers.cloudflare.com/vectorize/reference/metadata-filtering/ ("metadata indexes need to be created … before vectors can be inserted"; up to 10; string/number/boolean) | ✓ |
| bge-base-en-v1.5: 768 dims, 512 input tokens | developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/ | ✓ |
| `embed` "sends up to 100 texts in one call" | The same page says only "Batch: Yes" | Unsourced: reworded to "a batch … at most 50 chunks, so one call per source" (should) |
| bge-reranker-base input `query`, `contexts`, `top_k`; response refers to the contexts' index | developers.cloudflare.com/workers-ai/models/bge-reranker-base/ | ✓ (the generated-types gotcha matches) |
| D1 supports FTS5 | developers.cloudflare.com/d1/sql-api/sql-statements/ ("FTS5 module … for full-text search") | ✓ |
| AI Search: managed, hybrid (semantic + keyword), metadata filters, Workers binding | developers.cloudflare.com/ai-search/ | ✓ |
| Contextual retrieval: 49%, 67% with reranking; embeddings + BM25 beat embeddings alone | anthropic.com/research/contextual-retrieval (the `/engineering/` URL redirects; updated) | ✓ The figures are top-20 failure rates; the wording stays as is |
| Haiku 5.5 caching: 512-token minimum, 5-minute lifetime, writes 1.25×, reads 0.1× | platform.claude.com/docs/en/build-with-claude/prompt-caching ("512 tokens for … Claude Haiku 5.5"; "5-minute cache writes cost 25 percent more"; "All other models use the standard 0.1x multiplier") | ✓ |

## Honesty

- **Lesson 06 "wrangler dev (log)" (must, fixed).** A `:::terminal` with an
  invented command. The two lines are verbatim from e-06.txt ("dev log:", after
  sending `trip.md`). They now sit in prose that says where they came from, in a
  plain ```json fence.
- **Lesson 06 context rows (should, fixed).** The block showed 5 of the 10
  recorded rows without saying so. It now says "the first five of its ten rows",
  and that the brief became source 6.
- **Lesson 09 check curl (should, fixed).** It used single quotes, but the
  recording has double quotes. It now matches e-09.txt:43.
- **Lesson 02 sources query.** It's verbatim from e-02.txt, `url` column
  included, so there was nothing to fix.
- **Every other terminal block** is verbatim, checked by script after the edits.
  The fallback model is named each time (`glm-4.7-flash`, "not Claude").
- **Caching is never claimed as observed.** Lesson 06 says plainly that
  `cachedTokens` was 0 on the fallback and the file was under 512 tokens, and
  tells the learner to check their own log. Lesson 09 makes no live-deploy
  claim and labels the dry run as a dry run.

## Security asides

- **Retrieval lock (07).** Not overclaimed. "Three places" is right: the
  whole-chat check (`retrievedInChat` → reading tools only, and writing tools
  are never built), `prepareStep` → `READ_ONLY`, and the `afterPage` throw on
  `turn.retrieved`. The password turn is described as the lock working with a
  made-up reason from the fallback model. That's honest.
- **Owner re-check (05).** `hydrate` repeats `c.owner = ?` after the Vectorize
  filter. As claimed.
- **FTS quoting (05).** Words are `[\p{L}\p{N}]+`, so they can never hold a
  `"`, and quoting them makes FTS5 read plain words. "Can't inject syntax"
  holds.
- **Eval guard (08/09).** The bug is described correctly: chunk ids aren't
  owner-scoped, so the upsert overwrites real vectors and the cleanup deletes
  them. The three guards (config regex, in-file `EVAL_INDEX` check, prefix
  check before delete) match `e-09`. The quiz answer matches the code.
- **saveLink (02).** Exact typed links only, plus `needsApproval`, plus the page
  lock. As claimed.

## `:::verify` vs `check.ts` at e-09

The path nonce `bits-checkpoint-e09` (19 characters) passes
`/^[A-Za-z0-9_-]{8,64}$/`. The response is `{ nonce, tag: 'e-09', probe }`, so
`json keys=nonce,tag,probe`, the nonce echo and `(e-09|[f-g]-\d\d)` all match.
The hint's `hello-from-me` (13 characters) is valid too. ✓

## Checks run

- `pnpm content validate content/courses/retrieval-without-tears`: 0 errors
  (4 known warnings: sql has no highlighter).
- `KLIPPY_DIR=/home/ryan/code/klippy pnpm content snippets …`: 47 snippets,
  0 errors.
- `coach:eval --course retrieval-without-tears`: 51/51 agree (100%), 0
  unusable.

## Klippy items (not edited; for the owner)

1. The `vectors.ts` comment "up to 100 texts per call" has no Cloudflare
   source (the model page says only "Batch: Yes"). Source it or drop the
   number.
2. The `chunks` table export in `packages/db/src/index.ts` is never imported.
   Either use it or drop it, so lessons don't have to explain it.
3. Optional: e-08 could ship without the `eval:retrieval` script, since the
   lesson tells learners not to run it. Then e-09 would add it, and the
   lesson text would match the tags exactly.
