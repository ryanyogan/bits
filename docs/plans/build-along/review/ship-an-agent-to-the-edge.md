# Review: Ship an agent to the edge (course F) and the MCP stub, steel-man pass

2026-11-03. Docs were fetched live with Firecrawl (`maxAge: 0`) that day,
except where the lesson's own sources block already records a `maxAge: 0`
check made that day (marked "per f-0N.txt").

## Accuracy

| Claim | Source (2026-11-03) | Verdict |
|---|---|---|
| `workers_dev: false` leaves version URLs on; `preview_urls: false` closes them | workers/configuration/routing/workers-dev/, versions-and-deployments/version-urls/ | ✓ |
| AI Gateway caching is off by default; `cacheTtl` applies only "for a request that already uses caching"; `cacheKey` opts in; 60 s minimum | ai-gateway/features/caching/ | ✓ The lesson-02 quiz is right |
| Spend limits: dollar budgets by model, provider or metadata, split by value, 429 once spent | ai-gateway/features/spend-limits/ | ✓ but missing caveats (**should, fixed**): cost is recorded after completion, so concurrent bursts briefly exceed; best-effort estimate; only models with known pricing |
| Budget alerts fire the next day | Billing changelog ("budget alerts fire the day after the threshold is reached") | ✓ Source added |
| Rate Limiting binding: approximate, per location, period 10 or 60, key on users not IPs, a DO for exact limits | workers/runtime-apis/bindings/rate-limit/ | ✓ |
| Workers Logs indexes logged-object fields; Query Builder Count/Sum/P90, Group By, Save Query | per f-04.txt (maxAge 0) | ✓ |
| `secrets.required`: `wrangler deploy` fails if a secret is missing | workers/configuration/secrets/ ("wrangler deploy and wrangler versions upload will fail with a clear error") | ✓ |
| wrangler-action v4.1.3 `preview --name pr-N`, `preview-url` output, Previews need Wrangler 4.136.3+, an installed matching `wranglerVersion` is reused | github.com/cloudflare/wrangler-action README | ✓ |
| Previews don't inherit production; "Service bindings from a Preview call the bound Worker's production deployment"; base-config secrets; public unless Access | per f-07.txt (maxAge 0) | ✓ |
| Custom domain: `routes: [{ pattern, custom_domain: true }]`, needs a zone in your account, routes turn off workers.dev | per f-07.txt (maxAge 0) | ✓ |
| MCP stub: `createMcpHandler`, Streamable HTTP, OAuth | agents/model-context-protocol/ (updated 2026-10-27: "Streamable HTTP … OAuth"); apis/handler-api/ (`createMcpHandler` from `agents/mcp/server`) | ✓ No change |

## Security claims

- **"Exact daily budget" (should, fixed).** The count is exact (one writer per
  Klippy). The cap isn't: the refusal check runs once, before each turn, so a
  day can go over by up to one turn of 8 calls, even after the f-04/f-05
  fixes. Lesson 03 also said the estimate in lesson 4 helps here, and it
  doesn't. Fixed:
  - lesson 03: the heading, the closing paragraph and the quiz;
  - lesson 08: the intro;
  - `course.md`: the outcome.
- **The injection test** (lesson 05) matches `injection.spec.ts` at f-05:
  - the tool outcomes, `fetch` called once, notes and facts unchanged;
  - both wrappers asserted.

  The lesson calls the system-prompt line "a hint, not the lock", and the
  fallback's refusal "luck, not safety". ✓ Not overclaimed.
- **Klippy is personal** (01, `course.md`, 05): the notes table has no owner,
  so only your id goes in. ✓

## Honesty

Every recorded block is now verbatim from f-0N.txt, or says how it's trimmed:

- **03 budget chat (should, fixed).** The recorded first line was missing. Added.
- **04 log line (should, fixed).** It's shown out of its row wrapper, and now
  says so. Labels that looked like runnable SQL now say they're shortened. The
  new here-doc command is labelled as written for the lesson.
- **05 real run (should, fixed).** The block is now "the first turn, as
  recorded", with its header line. "The saved chat shows one tool call" was
  wrong: the second turn called `listNotes`. It now says that turn called one
  tool.
- **08 tour chat (nit, fixed).** The tool card text, `searchNotes Done`, was
  dropped. It's restored, and the block says it's the page's text.
- **Fallback labelling.** Every reply block says the Workers AI fallback
  answered, not Claude. ✓
- **No deploy claimed.** Lessons 01, 04, 06, 07 and 08 each say what wasn't
  run: the deploy, the saved queries, the CI deploy, `wrangler preview` and
  the custom domain. ✓

## Klippy items (not edited; for the Klippy lane)

1. `docs/outputs/f-01.txt`: the upload sends `pip.md`, but search returns
   title `pip-f01.md`. Re-record it, or note why.
2. `docs/outputs/f-04.txt` / `f-05.txt`: the observability curl commands
   aren't runnable as written. The SQL's single quotes close the shell's
   single-quoted `-d`. Record them with a here-doc, or `-d @query.json`.
3. Code comments that still say "exact":
   - `apps/agent/src/budget.ts` ("so it's exact");
   - `apps/web/app/limits.ts` ("The exact limit on spending is the agent's
     daily token budget").

   Say "exact count" instead. The cap can overshoot by one turn.
4. Optional, for the cap: check the budget in `prepareStep` too, after
   reserving. Returning `activeTools: []` or stopping once over budget would
   bound the overshoot to one call, not one turn.
5. f-08.txt: the tour's chat transcript says "messages on the page: 14" from
   earlier recordings. Use a fresh chat for a cleaner checkpoint recording.
