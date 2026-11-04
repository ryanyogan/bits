---
# sources (checked 2026-11-03):
# - Workers AI, @cf/baai/bge-base-en-v1.5 (max 512 input tokens)
#   https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/
# - Anthropic, Introducing Contextual Retrieval (chunks lose their context; small chunks, a few hundred tokens)
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Cloudflare D1, batch() (statements run in one transaction)
#   https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
# - Klippy e-02 → e-03, recorded output docs/outputs/e-03.txt (2026-11-03).
title: "Chunking"
order: 3
minutes: 20
xp: 60
module: Get it in
device: desk
tag: e-02
verified: 2026-11-03
versions:
  agents: "0.33.0"
  wrangler: "4.157.0"
---

A search should return the **paragraph** that answers the question, not a
whole 20-page PDF. So each source is cut into **chunks**: pieces small
enough to be precise, big enough to make sense alone.

### 1. How big, and where to cut

- **About 300 tokens** (1,200 characters). The embedding model you'll use
  next reads at most 512 tokens, and a smaller chunk matches more sharply.
- **Along the structure.** Paragraphs stay whole, and a heading always
  starts a new chunk, so a chunk is about one thing.
- **With some overlap.** The last 200 characters of one chunk start the
  next, so a sentence cut at the border is whole in one of them.

### 2. The chunker

Create `apps/agent/src/ingest/chunk.ts`. It's pure, so it's easy to test:

:::code{file="apps/agent/src/ingest/chunk.ts" lang="ts" tag="e-03" highlight="8-21" label="apps/agent/src/ingest/chunk.ts"}
// About 300 tokens per chunk: small enough to be precise, well under the embedding model's 512-token limit.
export const CHUNK_CHARS = 1200;
// The end of one chunk is repeated at the start of the next, so a sentence cut at the border is whole in one of them.
export const OVERLAP = 200;

// Cut Markdown into chunks along its structure: paragraphs are kept whole, and a heading always starts a new chunk.
export function chunk(markdown: string): string[] {
	const pieces = markdown
		.split(/\n\s*\n/) // paragraphs (a blank line between them)
		.map((p) => p.trim())
		.filter(Boolean)
		.flatMap((p) => p.match(new RegExp(`[^]{1,${CHUNK_CHARS}}`, 'g')) ?? []); // a giant paragraph is cut by length
	const chunks: string[] = [];
	let current = '';
	for (const piece of pieces) {
		const heading = piece.startsWith('#');
		if (current && (heading || current.length + piece.length > CHUNK_CHARS)) {
			chunks.push(current);
			current = heading ? '' : current.slice(-OVERLAP).replace(/^\S*\s+/, ''); // the overlap, from a word boundary
		}
		current = current ? `${current}\n\n${piece}` : piece;
	}
	if (current) chunks.push(current);
	return chunks;
:::

- Split on blank lines to get paragraphs. A paragraph longer than 1,200
  characters is cut by length (rare, but one giant line shouldn't break it).
- Add pieces to `current` until the next one would overflow, or a heading
  arrives. Then close the chunk.
- The next chunk starts with the overlap, trimmed to a word boundary.
  After a heading, it starts clean.

### 3. Save the chunks

A table, `packages/db/migrations/0003_chunks.sql`:

:::code{file="packages/db/migrations/0003_chunks.sql" lang="sql" tag="e-03" highlight="3-8" label="packages/db/migrations/0003_chunks.sql"}
-- Each source cut into pieces small enough to search and to embed. position is the order within the source.
-- Deleting a source (or the note behind it) deletes its chunks.
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  owner TEXT NOT NULL, -- copied from the source, so a search can filter without a join
  position INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX chunks_source ON chunks (source_id, position);
:::

`owner` is copied onto each chunk, so a search can filter without a join.
Then `saveChunks` in `src/ingest/sources.ts`:

:::code{file="apps/agent/src/ingest/sources.ts" lang="ts" tag="e-03" highlight="8-10" label="apps/agent/src/ingest/sources.ts"}
// At most 50 chunks a source (60,000 characters / 1,200), so one big page can't run up the embedding bill.
export const MAX_CHUNKS = 50;

// Replace a source's chunks in one batch: a retried step starts clean instead of adding duplicates.
export async function saveChunks(d1: D1Database, source: { id: number; owner: string }, texts: string[]) {
	const insert = d1.prepare('INSERT INTO chunks (source_id, owner, position, text) VALUES (?, ?, ?, ?)');
	await d1.batch([
		d1.prepare('DELETE FROM chunks WHERE source_id = ?').bind(source.id),
		...texts.slice(0, MAX_CHUNKS).map((text, position) => insert.bind(source.id, source.owner, position, text)),
	]);
	return Math.min(texts.length, MAX_CHUNKS);
}
:::

The delete and the inserts go in **one batch**, which D1 runs as one
transaction. A retried step starts clean instead of adding a second copy.
The cap, 50 chunks, keeps one huge page from running up the bill later.

### 4. A step in the Workflow

In `workflow.ts`, keep the text in `body` (a fetched link replaces it with
the page), then add the step before `'ready'`:

:::code{file="apps/agent/src/ingest/workflow.ts" lang="ts" tag="e-03" highlight="2" label="apps/agent/src/ingest/workflow.ts"}
			// Cut the text into chunks and save them, each with its source and position.
			const count = await step.do('chunk', () => saveChunks(this.env.DB, source, chunk(body)));
			await step.do('ready', () => db.update(sources, sourceId, { status: 'ready' }));
			return { sourceId, status: 'ready', chunks: count };
:::

Apply the migration: `pnpm exec wrangler d1 migrations apply DB --local`.

### 5. Run it

Send a longer file. Ours is the UI brief from course D, 4,409 bytes of
Markdown:

:::terminal{cmd="curl -s -X POST -H &quot;Authorization: Bearer $T&quot; -F &quot;file=@docs/ui-brief.md;type=text/markdown&quot; http://localhost:8801/agents/klippy/me/file"}
{"id":3,"title":"ui-brief.md","status":"queued"}
:::

:::terminal{cmd="wrangler d1 execute DB --local --json --command &quot;SELECT s.id, s.title, s.status, count(c.id) AS chunks, max(length(c.text)) AS longest, min(length(c.text)) AS shortest FROM sources s LEFT JOIN chunks c ON c.source_id = s.id WHERE s.title = 'ui-brief.md' GROUP BY s.id&quot;"}
{"id":3,"title":"ui-brief.md","status":"ready",[volt]"chunks":10[text],"longest":1004,"shortest":108}
:::

Ten chunks, none over 1,200 characters. How each one starts:

:::terminal{cmd="wrangler d1 execute DB --local --json --command &quot;SELECT position, substr(text, 1, 70) AS starts FROM chunks WHERE source_id = 3 ORDER BY position LIMIT 5&quot;"}
{"position":0,"starts":"# Klippy on the web: UI brief\n\nWritten 2026-11-03, before any front-en"}
{"position":1,"starts":"## Goal\n\nOne person, signed in with GitHub, chats with their own Klipp"}
{"position":2,"starts":"## Who it's for\n\nThe owner of this Klippy. It's a personal app: only G"}
{"position":3,"starts":"## Screens\n\n| Path | What it shows | Signed out |\n|---|---|---|\n| `/` "}
{"position":4,"starts":"## States to design\n\n- Chat: empty (\"Say hi to Klippy\"), streaming (te"}
:::

Every chunk starts at a heading here, because this brief has short
sections. A long section would be split with overlap instead.

Now look at chunk 3 alone. "Signed out" of **what**? The chunk doesn't say
it's about Klippy's web app. That missing context is lesson 6's problem.

### 6. Prove it

Copy [`test/chunk.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-03/apps/agent/test/chunk.spec.ts)
and the updated [`test/ingest.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-03/apps/agent/test/ingest.spec.ts).
Four tests for the chunker: a short text stays one chunk, every heading
starts a new one, paragraphs pack up to the size with overlap, and a giant
paragraph is cut by length. Ours: 16 files, 76 tests passed.

:::quiz{id="why-overlap" xp=20}
Why does each chunk start with the end of the one before?

- [ ] To make the chunks bigger
  Not quite. Bigger chunks match less sharply. The overlap is only 200 characters.
- [x] So a sentence cut at a border is whole in one of the two chunks
  Right. Without it, the answer could be split across two chunks and match neither well.
- [ ] So the search returns two chunks for every question
  Not quite. Search ranks chunks one by one; the overlap doesn't pair them.
:::

Your code matches tag `e-03`
([changes from e-02](https://github.com/ryanyogan/klippy/compare/e-02...e-03)).

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "bge-base-en-v1.5" by="Cloudflare Workers AI" url="https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/"
:::
