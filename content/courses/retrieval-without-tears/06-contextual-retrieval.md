---
# sources (checked 2026-11-03):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): prepend chunk-specific context before embedding and
#   BM25 indexing; contextual embeddings + contextual BM25 cut failed retrievals by 49%, 67% with reranking
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Anthropic, Prompt caching (Claude Haiku 5.5: minimum 512 tokens; 5-minute lifetime; 5-minute writes 1.25x base
#   input, hits 0.1x)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-caching
# - Anthropic cookbook, Enhancing RAG with contextual retrieval (the original idea and prompt; ours is our own wording)
#   https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide
# - AI SDK, Anthropic provider (cacheControl in providerOptions); @ai-sdk/anthropic 4.0.96
#   https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
# - Klippy e-05 → e-06, recorded output docs/outputs/e-06.txt (2026-11-03).
#   The Workers AI fallback (@cf/zai-org/glm-4.7-flash) answered, not Claude. Prompt caching was not exercised.
title: "Contextual retrieval"
order: 6
minutes: 30
xp: 90
module: Find it
device: desk
tag: e-05
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  "@ai-sdk/anthropic": "4.0.96"
  wrangler: "4.157.0"
---

Remember the chunk that said "Signed out" without saying of what? Cut out
of its document, a chunk loses its context. Anthropic's fix: before you
index a chunk, ask Claude for **one sentence** that places it in its
document, and put that sentence in front of the chunk. Both searches then
see it. In Anthropic's tests, this cut failed retrievals by 49%, and by
67% with a reranker (lesson 7).

### 1. Write the context prompt

The prompt is the whole trick, so write it yourself first. The chunk below
is lonely: nothing in it says "battery" or "warranty guide".

:::prompt{id="contextualize-chunk" xp=50 coach}
Write the prompt that situates a chunk in its document
- goal "Get Claude to write a one- or two-sentence context that places the lonely chunk in its document, so search can find it, and nothing else"
- placeholder "…document and chunk… Write a short context that places this chunk in the document, to help search find it. Reply with only…"
- draft "<document> Orbit Bikes warranty guide (2026). Frames: lifetime warranty for the first owner. E-bike batteries: 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </document> <chunk> Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </chunk>"
- check "Includes the document and chunk" /<document>/i
- check "Includes the document and chunk" /<chunk>/i
- check "Includes the document and chunk" /lifetime/i
- check "Includes the document and chunk" /battery label/i
- check "Asks for context" /context|situate|where (this|the) chunk|place/i
- expect "One or two sentences" sentences<=2
- expect "Names the battery warranty" match /batter/i
- rubric "Names the document and the section the chunk comes from" must evidence
- rubric "Says what this chunk covers, not the whole document" must
- rubric "Gives only the context, with no preamble and no copy of the chunk" should
- hint "Search finds a chunk by the words in it. Which words is the lonely chunk missing?"
- hint "A summary of the whole guide would be the same for every chunk. Ask for context about this chunk, and say what it's for."
- hint "Say the context is for search, ask for one or two sentences that place this chunk in the document, and ask for only that."
- reference "<document> Orbit Bikes warranty guide (2026). Frames: lifetime warranty for the first owner. E-bike batteries: 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </document>\n<chunk> Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. </chunk>\n\nWrite one or two sentences that place this chunk within the document, so a search for it finds it. Name the document and the section. Reply with only the context."
- run temperature=[1.0]
- example T=1.0 "From Orbit Bikes' 2026 warranty guide: how to file a claim under the 2-year e-bike battery warranty."
- example T=1.0 "This chunk is from the e-bike battery warranty section of Orbit Bikes' 2026 warranty guide and explains the claim deadline and what to include."
- example T=1.0 "Orbit Bikes warranty guide (2026), battery warranty claims: the deadline and documents needed to claim on an e-bike battery."
- success "That context is what makes the lonely chunk findable. Now Klippy does it for every chunk." next="Next: put it in Klippy →"
:::

### 2. A column for the context

`packages/db/migrations/0005_chunk_context.sql` adds the column and
rebuilds the keyword index over **both** columns, so keyword search reads
the context too:

:::code{file="packages/db/migrations/0005_chunk_context.sql" lang="sql" tag="e-06" highlight="3-8" label="packages/db/migrations/0005_chunk_context.sql"}
-- Contextual retrieval: one sentence per chunk that says where it sits in its document. Keyword search reads it too,
-- so the FTS index is rebuilt with two columns (a migration never edits an old one: it replaces what it must).
ALTER TABLE chunks ADD COLUMN context TEXT NOT NULL DEFAULT '';
DROP TRIGGER chunks_fts_insert;
DROP TRIGGER chunks_fts_delete;
DROP TRIGGER chunks_fts_update;
DROP TABLE chunks_fts;
CREATE VIRTUAL TABLE chunks_fts USING fts5(context, text, content = 'chunks', content_rowid = 'id', tokenize = 'porter unicode61');
:::

Copy the rest (the three triggers, now over `context, text`, and the
`rebuild`) from the tag. A migration never edits an old one: it replaces
what it must. Add `context` to the `chunks` table in `packages/db`, and
`pnpm add @ai-sdk/anthropic@4.0.96` in `apps/agent`.

### 3. Claude, with caching in reach

Every chunk of a document sends the **same** document. That's what
**prompt caching** is for: mark the document, and later calls read it from
Claude's cache. On Claude Haiku 5.5, a cache needs at least 512 tokens,
lives 5 minutes, costs 1.25× to write, and about 0.1× to read.

Caching needs Anthropic's own request format, so `src/model.ts` gets a
second model, built with Anthropic's provider and sent through the same AI
Gateway:

:::code{file="apps/agent/src/model.ts" lang="ts" tag="e-06" highlight="4-9" label="apps/agent/src/model.ts"}
// For the ingest step that writes a line of context per chunk (e-06): Claude Haiku through the same gateway, but as
// Anthropic's own model object, so the request is Anthropic Messages and prompt caching (cacheControl) reaches Claude.
// The apiKey is a placeholder: the gateway strips it and uses the key stored on the gateway (BYOK).
export function contextModel(env: Env) {
	const ai = createAI({ binding: env.AI, id: 'default' });
	const anthropic = createAnthropic({ apiKey: 'stored-on-the-gateway' });
	return ai(anthropic('claude-haiku-5-5'), {
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}
:::

The `apiKey` is a placeholder: the gateway strips it and uses the key
stored there. A catalog id like `anthropic/claude-haiku-5.5` wouldn't do:
it goes through the gateway as an OpenAI-style chat, and `cache_control`
can't travel that way.

### 4. One sentence per chunk

Create `apps/agent/src/ingest/context.ts`:

:::code{file="apps/agent/src/ingest/context.ts" lang="ts" tag="e-06" highlight="10-12" label="apps/agent/src/ingest/context.ts"}
export async function contextFor(env: Env, document: string, chunk: string, model: LanguageModel = contextModel(env)) {
	const { text, providerMetadata, usage } = await generateText({
		model,
		maxOutputTokens: 100,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: `Here is a document:\n<document>\n${document.slice(0, MAX_DOCUMENT)}\n</document>`,
						providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
					},
					{
...
	});
	// Which model answered (Claude, or the Workers AI fallback) and how much of the prompt came from the cache.
	const answeredBy = (providerMetadata?.cloudflare as { model?: string } | undefined)?.model;
	console.log(JSON.stringify({ event: 'context', model: answeredBy, inputTokens: usage.inputTokens, cachedTokens: usage.inputTokenDetails?.cacheReadTokens }));
	return text.trim().slice(0, MAX_CONTEXT);
:::

- The document goes **first**, in its own part, marked
  `cacheControl: ephemeral`. The chunk comes after, so the cached prefix is
  the same for every chunk of that document.
- `maxOutputTokens: 100`, and the reply is cut at 300 characters. The
  document is capped at 24,000 characters (about 6,000 tokens).
- The log line says **which model answered**, and how many input tokens
  came from the cache. You'll need it in step 6.

### 5. In the Workflow, one step per chunk

In `workflow.ts`, between `'chunk'` and `'embed'`:

:::code{file="apps/agent/src/ingest/workflow.ts" lang="ts" tag="e-06" highlight="5-12" label="apps/agent/src/ingest/workflow.ts"}
			// Contextual retrieval: one sentence of context per chunk, one step each, so a retry never redoes a finished one.
			// A source of one chunk is its own context, so it costs no call.
			for (let position = 0; count > 1 && position < count; position++) {
				await step.do(`context ${position}`, { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } }, async () => {
					const row = await this.env.DB.prepare('SELECT id, text FROM chunks WHERE source_id = ? AND position = ?')
						.bind(sourceId, position)
						.first<{ id: number; text: string }>();
					if (!row) return '';
					const context = await contextFor(this.env, body, row.text);
					await this.env.DB.prepare('UPDATE chunks SET context = ? WHERE id = ?').bind(context, row.id).run();
					return context;
				});
			}
:::

- One step per chunk, so a retry never pays for a finished one.
- One after another **on purpose**: the first call writes the cache, the
  rest read it. Parallel calls would all miss.
- A one-chunk source (most notes) is its own context: no call.

Last, `upsertChunks` embeds `context` + blank line + `text`, so the vector
carries the context too
([diff](https://github.com/ryanyogan/klippy/compare/e-05...e-06)).

### 6. Run it, and read the log honestly

Apply the migration, then send the UI brief again:

:::terminal{cmd="wrangler d1 execute DB --local --json --command &quot;SELECT position, context FROM chunks WHERE source_id = 6 ORDER BY position&quot;"}
{"position":0,"context":"This chunk is the document header and states its date, context, and purpose."}
{"position":1,"context":"The Goal section describes why the Klippy on the web interface exists and the primary user experience it aims to provide."}
{"position":2,"context":"The chunk defines the target audience as the Klippy's owner and the restriction to GitHub accounts on an allowlist."}
[volt]{"position":3,"context":"This chunk outlines the application's routes, describing what each page displays and its access control behavior."}[text]
{"position":4,"context":"This chunk sits under the section called \"States to design\" and lists all the user interface states for the application, including the chat and notes screens."}
:::

Chunk 3, the screens table, now says it's about the app's routes and
their access control. These lines came from the **Workers AI fallback**,
not Claude. And the log, from a two-chunk file:

:::terminal{cmd="wrangler dev (log)"}
{"event":"context",[synapse]"model":"@cf/zai-org/glm-4.7-flash"[text],"inputTokens":95,[synapse]"cachedTokens":0[text]}
{"event":"context",[synapse]"model":"@cf/zai-org/glm-4.7-flash"[text],"inputTokens":93,"cachedTokens":0}
:::

**What we didn't record: caching.** Our gateway had no Anthropic key, so
every call fell back to `glm-4.7-flash`, which has no cache, and
`cachedTokens` is 0. That file was also far under Haiku's 512-token
minimum. With Claude connected and a document over 512 tokens, expect the
**second** call to show `cachedTokens` above 0. Check your own log rather
than trusting ours.

Copy [`test/context.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-06/apps/agent/test/context.spec.ts),
[`test/ingest.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-06/apps/agent/test/ingest.spec.ts)
and [`test/vectors.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-06/apps/agent/test/vectors.spec.ts).
They check the prompt's shape (the cache mark on the document part only),
the cap, and that keyword search finds words from the context. Ours: 19
files, 87 tests passed.

:::quiz{id="context-sequential" xp=20}
Why do the context calls for one document run one after another, not in parallel?

- [ ] Workers can't run calls in parallel
  Not quite. They can. Hybrid search runs two searches in parallel.
- [x] The first call writes the cache, and the later ones can only read it once it's written
  Right. Parallel calls would all miss the cache and each pay full price for the document.
- [ ] Claude refuses parallel requests
  Not quite. It doesn't. The point is the cache.
:::

Your code matches tag `e-06`
([changes from e-05](https://github.com/ryanyogan/klippy/compare/e-05...e-06)).

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "Prompt caching" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-caching"
- read "Enhancing RAG with contextual retrieval (cookbook)" by="Anthropic" deep url="https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide"
:::
