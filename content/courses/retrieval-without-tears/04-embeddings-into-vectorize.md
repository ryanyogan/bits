---
# sources (checked 2026-11-03):
# - Cloudflare, Vectorize and Workers AI tutorial (bge-base-en-v1.5, --dimensions=768 --metric=cosine; updated 2026-10-12)
#   https://developers.cloudflare.com/vectorize/get-started/embeddings/
# - Cloudflare Vectorize, Metadata filtering (create the metadata index before inserting vectors)
#   https://developers.cloudflare.com/vectorize/reference/metadata-filtering/
# - Workers AI, @cf/baai/bge-base-en-v1.5 (768 dimensions, 512 input tokens)
#   https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/
# - Cloudflare AI Search (managed search: index content, query with natural language; hybrid search, metadata filters)
#   https://developers.cloudflare.com/ai-search/
# - 3Blue1Brown, Transformers, the tech behind LLMs (embeddings as directions)
#   https://www.youtube.com/watch?v=wjZofJX0v4M
# - Klippy e-03 → e-04, recorded output docs/outputs/e-04.txt (2026-11-03).
title: "Embeddings into Vectorize"
order: 4
minutes: 25
xp: 70
module: Find it
device: desk
tag: e-03
verified: 2026-11-03
versions:
  agents: "0.33.0"
  wrangler: "4.157.0"
---

"What does Pip like to eat?" and "She likes carrots" share no words, but
they're about the same thing. To find a chunk by **meaning**, you turn
text into an **embedding**: a list of numbers where texts that mean
similar things point in similar directions.

### 1. Meaning as numbers

The embedding model here, `@cf/baai/bge-base-en-v1.5` on Workers AI, turns
any text into **768 numbers**. You embed every chunk once, and each
question when it's asked. Then you compare directions with **cosine
similarity**: 1 means the same direction (the same meaning), and lower
means less related.

A **vector database** stores the vectors and finds the closest ones fast.
On Cloudflare that's **Vectorize**.

### 2. Create the index

In `apps/agent`, create an index that matches the model: 768 dimensions,
compared by cosine. Neither can change later.

:::terminal{cmd="pnpm exec wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine"}
[volt]✅ Successfully created a new Vectorize index: 'klippy-notes'[text]
:::

Then a **metadata index** on `owner`, so a search can ask for one Klippy's
vectors only. Create it **now, before any vectors go in**: Vectorize only
indexes metadata for vectors written after the index exists.

:::terminal{cmd="pnpm exec wrangler vectorize create-metadata-index klippy-notes --propertyName=owner --type=string"}
[volt]✅ Successfully enqueued metadata index creation request.[text] Mutation changeset identifier: 77f21857-16e1-42f5-827b-89fc08538089.
:::

Bind it in `wrangler.jsonc`, then run `pnpm run cf-typegen`:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="e-04" highlight="4" label="apps/agent/wrangler.jsonc"}
	"durable_objects": { "bindings": [{ "name": "Klippy", "class_name": "Klippy" }] },
	// Vectors for every chunk, to search by meaning. There's no local Vectorize, so `wrangler dev` uses the real index
	// (remote); the tests use a stand-in. Created with: wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine
	"vectorize": [{ "binding": "VECTORIZE", "index_name": "klippy-notes", "remote": true }],
:::

There's no local Vectorize, so `"remote": true`: `wrangler dev` uses the
real index. The tests use a stand-in.

### 3. Embed and store

Create `apps/agent/src/retrieval/vectors.ts`:

:::code{file="apps/agent/src/retrieval/vectors.ts" lang="ts" tag="e-04" highlight="16-22" label="apps/agent/src/retrieval/vectors.ts"}
// The embedding model from Cloudflare's Vectorize tutorial: 768 numbers per text, compared by cosine.
// The index was created to match: wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// Turn texts into vectors with Workers AI, up to 100 texts per call.
export async function embed(env: Env, texts: string[]): Promise<number[][]> {
	const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
	if (!('data' in result) || !result.data) throw new Error('No embeddings came back');
	return result.data;
}

export type ChunkRow = { id: number; owner: string; source_id: number; text: string };

// Store one vector per chunk. The id ties it to the chunk row in D1, and the metadata says whose it is,
// so a search can ask for one Klippy's chunks only (owner has a metadata index). Upsert: a retry overwrites.
export async function upsertChunks(env: Env, rows: ChunkRow[]) {
	if (rows.length === 0) return 0;
	const vectors = await embed(env, rows.map((row) => row.text));
	await env.VECTORIZE.upsert(
		rows.map((row, i) => ({ id: `chunk-${row.id}`, values: vectors[i], metadata: { owner: row.owner, sourceId: row.source_id } })),
	);
	return rows.length;
}
:::

- `embed` sends a batch of texts in one Workers AI call. A source has at most 50 chunks, so that is one call per source.
- Each vector's id is `chunk-<D1 id>`, so a match leads back to its row.
- `metadata.owner` is the wall between people. Every search will filter
  on it.
- `upsert`, not `insert`: a retried step overwrites instead of failing.

### 4. A step in the Workflow

Import the new helper and type at the top of `workflow.ts`, under the
other imports:

:::code{file="apps/agent/src/ingest/workflow.ts" lang="ts" tag="e-04" label="apps/agent/src/ingest/workflow.ts"}
import { type ChunkRow, upsertChunks } from '../retrieval/vectors';
:::

After `'chunk'`, read the chunks back and embed them, with retries:

:::code{file="apps/agent/src/ingest/workflow.ts" lang="ts" tag="e-04" highlight="3-8" label="apps/agent/src/ingest/workflow.ts"}
			const count = await step.do('chunk', () => saveChunks(this.env.DB, source, chunk(body)));
			// Embed every chunk and store the vectors in Vectorize (Workers AI is called once for up to 50 chunks).
			await step.do('embed', { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } }, async () => {
				const { results } = await this.env.DB.prepare('SELECT id, owner, source_id, text FROM chunks WHERE source_id = ? ORDER BY position')
					.bind(sourceId)
					.all<ChunkRow>();
				return upsertChunks(this.env, results);
			});
			await step.do('ready', () => db.update(sources, sourceId, { status: 'ready' }));
:::

At most 50 chunks, so it's one Workers AI call per source.

### 5. Run it

Send two files, then wait. **Vectorize is eventually consistent**: the
upsert returns at once, and the vectors became searchable about a minute
later for us. If a query finds nothing right away, it hasn't failed. Wait
and ask again.

:::terminal{cmd="pnpm exec wrangler vectorize query klippy-notes --vector-id chunk-11 --top-k 3 --return-metadata all --filter '{&quot;owner&quot;:&quot;me&quot;}'"}
{
  "count": 3,
  "matches": [
    [volt]{ "id": "chunk-11", "score": 0.9999988, "metadata": { "owner": "me", "sourceId": 4 } },[text]
    { "id": "chunk-15", "score": 0.57529664, "metadata": { "owner": "me", "sourceId": 5 } },
    { "id": "chunk-21", "score": 0.5639974, "metadata": { "owner": "me", "sourceId": 5 } }
  ]
}
:::

`chunk-11` is the Pip note. Queried with its own vector, it matches itself
at about 1.0. The UI brief's chunks are only loosely related. Now ask as
someone else:

:::terminal{cmd="pnpm exec wrangler vectorize query klippy-notes --vector-id chunk-11 --top-k 3 --filter '{&quot;owner&quot;:&quot;someone-else&quot;}'"}
[synapse]▲ [WARNING] Could not find any relevant vectors[text]
:::

That's the owner wall working.

### 6. Prove it, and when not to build this

Copy [`test/vectors.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-04/apps/agent/test/vectors.spec.ts)
and the updated [`test/ingest.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-04/apps/agent/test/ingest.spec.ts):
every chunk is embedded in one call and stored under `chunk-<id>` with
its owner, and nothing is called for a source with no chunks. Ours: 17
files, 78 tests passed.

**When AI Search is the better call.** Cloudflare's **AI Search** is a
managed search service: point it at your content, and it handles indexing
and search (hybrid included) behind one binding. If you want "ask my docs"
running this afternoon and don't need your own ranking, start there. This
course builds the parts by hand so you know what's inside, and so Klippy
can apply per-person walls and locks of its own.

:::quiz{id="metadata-index-first" xp=20}
You upsert 500 vectors, then create the owner metadata index. What happens to a search filtered by owner?

- [ ] It works: the index covers every vector
  Not quite. Vectorize only indexes metadata for vectors written after the metadata index exists.
- [x] The 500 earlier vectors aren't found by the filter
  Right. Create the metadata index first, or upsert those vectors again after creating it.
- [ ] Vectorize refuses the upserts
  Not quite. The upserts succeed. The filter just can't see them.
:::

Your code matches tag `e-04`
([changes from e-03](https://github.com/ryanyogan/klippy/compare/e-03...e-04)).

:::rabbithole
- video "Transformers, the tech behind LLMs" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
- read "Vectorize and Workers AI" by="Cloudflare" url="https://developers.cloudflare.com/vectorize/get-started/embeddings/"
- read "AI Search" by="Cloudflare" url="https://developers.cloudflare.com/ai-search/"
:::
