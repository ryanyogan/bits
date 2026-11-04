---
# sources (checked 2026-11-03):
# - SQLite, FTS5 (external content tables, porter tokenizer, bm25 rank)
#   https://www.sqlite.org/fts5.html
# - Cloudflare D1, SQL statements (FTS5 is supported)
#   https://developers.cloudflare.com/d1/sql-api/sql-statements/
# - Cormack, Clarke & Büttcher, Reciprocal Rank Fusion (SIGIR 2009; k = 60)
#   https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
# - Anthropic, Introducing Contextual Retrieval (embeddings + BM25 beat embeddings alone)
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Klippy e-04 → e-05, recorded output docs/outputs/e-05.txt (2026-11-03).
title: "Keywords too: hybrid search"
order: 5
minutes: 25
xp: 70
module: Find it
device: desk
tag: e-04
verified: 2026-11-03
versions:
  agents: "0.33.0"
  wrangler: "4.157.0"
---

Embeddings find paraphrases, but they're fuzzy about **exact** tokens: a
flight number like `TP1337`, an error code, a file path. Keyword search is
the opposite. It nails exact words and misses paraphrases. Use both, and
merge the results. Anthropic's Contextual Retrieval post reports that
embeddings plus keyword search (BM25) beat embeddings alone.

### 1. Keyword search in D1

D1 is SQLite, and SQLite has **FTS5**, a full-text index. Add
`packages/db/migrations/0004_chunks_fts.sql`:

:::code{file="packages/db/migrations/0004_chunks_fts.sql" lang="sql" tag="e-05" highlight="3-6" label="packages/db/migrations/0004_chunks_fts.sql"}
-- Keyword search over chunks with SQLite's FTS5 (D1 supports it). The index points at chunks (content='chunks'), so
-- the text isn't stored twice, and three triggers keep it in step with every insert, delete and update.
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content = 'chunks', content_rowid = 'id', tokenize = 'porter unicode61');
CREATE TRIGGER chunks_fts_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.id, new.text);
END;
...
-- Index the chunks saved before this migration.
INSERT INTO chunks_fts (chunks_fts) VALUES ('rebuild');
:::

- `content = 'chunks'`: the index points at the chunks table, so the text
  isn't stored twice.
- `porter`: stemming, so "carrots" matches "carrot".
- Three triggers keep it in step with every insert, delete and update
  (the insert trigger is shown; copy all three from the tag).
- `'rebuild'` indexes the chunks you saved before this migration.

Apply it: `pnpm exec wrangler d1 migrations apply DB --local`.

### 2. Search by words, safely

Create `apps/agent/src/retrieval/search.ts`:

:::code{file="apps/agent/src/retrieval/search.ts" lang="ts" tag="e-05" highlight="3-6" label="apps/agent/src/retrieval/search.ts"}
// The chunk ids that share words with the question, best first (bm25), from this owner's chunks only.
export async function keywordSearch(d1: D1Database, owner: string, question: string, limit = 20): Promise<number[]> {
	// Each word in quotes, joined by OR: FTS5 treats quoted text as plain words, so the question can't inject syntax.
	const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
	if (words.length === 0) return [];
	const match = [...new Set(words)].map((word) => `"${word}"`).join(' OR ');
	const { results } = await d1
		.prepare('SELECT c.id FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid WHERE chunks_fts MATCH ? AND c.owner = ? ORDER BY rank LIMIT ?')
		.bind(match, owner, limit)
		.all<{ id: number }>();
	return results.map((row) => row.id);
}
:::

FTS5 has its own query language (`AND`, `NEAR`, `*`, column filters). The
question comes from a person, or a model, so it must never be read as
syntax. Each word is put in quotes and joined with `OR`, which FTS5 reads
as plain words. `ORDER BY rank` is bm25: rare words that match count most.
`c.owner = ?` keeps it to this Klippy's chunks.

The meaning side goes in `vectors.ts`, filtered the same way:

:::code{file="apps/agent/src/retrieval/vectors.ts" lang="ts" tag="e-05" highlight="3" label="apps/agent/src/retrieval/vectors.ts"}
export async function vectorSearch(env: Env, owner: string, question: string, topK = 20): Promise<number[]> {
	const [vector] = await embed(env, [question]);
	const { matches } = await env.VECTORIZE.query(vector, { topK, filter: { owner } });
	return matches.map((match) => Number(match.id.replace('chunk-', '')));
}
:::

### 3. Merge by rank, not by score

A bm25 score and a cosine score aren't on the same scale, so you can't add
them. **Reciprocal rank fusion** (RRF) ignores scores and uses positions:
each id earns `1 / (k + rank)` from every list it's in. Being near the top
of both lists beats being first in one. Create `src/retrieval/rrf.ts`:

:::code{file="apps/agent/src/retrieval/rrf.ts" lang="ts" tag="e-05" highlight="4-10" label="apps/agent/src/retrieval/rrf.ts"}
// Reciprocal rank fusion: merge ranked lists by position, not by score. Keyword scores (bm25) and cosine scores
// aren't comparable, but "2nd in one list, 1st in the other" is. Each id earns 1 / (k + rank) from every list it's in;
// k = 60 is the value from the original paper, and it keeps one list's top spot from drowning out the rest.
export function rrf(lists: number[][], k = 60): number[] {
	const scores = new Map<number, number>();
	for (const list of lists) {
		list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
	}
	return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
:::

`k = 60` comes from the original paper. It needs no tuning, which is why
it's the usual default.

### 4. Hybrid search, then the rows

Back in `search.ts`, run both searches in parallel, fuse, and fetch the
rows:

:::code{file="apps/agent/src/retrieval/search.ts" lang="ts" tag="e-05" highlight="3-5" label="apps/agent/src/retrieval/search.ts"}
// Hybrid search: keywords (exact names, codes, rare words) and meaning (paraphrases), merged by rank.
export async function hybridSearch(env: Env, owner: string, question: string, limit = 10): Promise<Hit[]> {
	const [byWords, byMeaning] = await Promise.all([keywordSearch(env.DB, owner, question), vectorSearch(env, owner, question)]);
	const ids = rrf([byWords, byMeaning]).slice(0, limit);
	return hydrate(env.DB, owner, ids);
}

// The chunks behind the ids, with their sources, in the same order. A vector whose chunk is gone is dropped, and so is
// anything that isn't this owner's (the owner check is repeated here, not left to the vector filter alone).
export async function hydrate(d1: D1Database, owner: string, ids: number[]): Promise<Hit[]> {
	if (ids.length === 0) return [];
	const { results } = await d1
		.prepare(
			`SELECT c.id AS chunkId, s.id AS sourceId, s.title, s.url, s.kind, c.text FROM chunks c JOIN sources s ON s.id = c.source_id
			 WHERE c.owner = ? AND c.id IN (SELECT value FROM json_each(?))`,
		)
		.bind(owner, JSON.stringify(ids))
		.all<Hit>();
	const byId = new Map(results.map((hit) => [hit.chunkId, hit]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
:::

`hydrate` checks the owner **again**. The vector filter should already
have done it, but a wall you can check twice, you check twice. It also
drops vectors whose chunk is gone.

To try it, `agent.ts` gets `GET /agents/klippy/<name>/search?q=`
(rate-limited, since each search costs an embedding; copy it from the
tag).

### 5. Run it

Apply the migration, restart `wrangler dev`, and ask the route a question:

:::terminal{cmd="curl -s -G -H &quot;Authorization: Bearer $T&quot; --data-urlencode &quot;q=What does Pip like to eat?&quot; http://localhost:8801/agents/klippy/me/search | jq -c '.hits[:3][] | {chunkId, title, starts: .text[0:60]}'"}
[volt]{"chunkId":11,"title":"pip.md","starts":"# Pip\n\nPip is my dog. She likes carrots and hates baths."}[text]
{"chunkId":15,"title":"ui-brief.md","starts":"## Screens\n\n| Path | What it shows | Signed out |\n|---|---|-"}
{"chunkId":13,"title":"ui-brief.md","starts":"## Goal\n\nOne person, signed in with GitHub, chats with their"}
:::

The Pip note wins: by meaning, and by the word "Pip". With `q=carrots`,
one plain word, the keyword side finds it first too:

:::terminal{cmd="curl -s -G -H &quot;Authorization: Bearer $T&quot; --data-urlencode &quot;q=carrots&quot; http://localhost:8801/agents/klippy/me/search | jq -c '.hits[:3][] | {chunkId, title, starts: .text[0:60]}'"}
[volt]{"chunkId":11,"title":"pip.md","starts":"# Pip\n\nPip is my dog. She likes carrots and hates baths."}[text]
{"chunkId":21,"title":"ui-brief.md","starts":"## References (gathered with Firecrawl, 2026-11-03; pages ar"}
{"chunkId":15,"title":"ui-brief.md","starts":"## Screens\n\n| Path | What it shows | Signed out |\n|---|---|-"}
:::

The other hits are filler: this Klippy has only two sources, and search
always returns its top few. Deciding whether a passage really answers the
question comes later, in lesson 7.

### 6. Prove it

Copy [`test/search.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-05/apps/agent/test/search.spec.ts)
and the updated [`test/approval.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-05/apps/agent/test/approval.spec.ts).
Five tests: RRF ranks an id found by both lists first, keyword search
stems and keeps to one owner, a deleted chunk leaves the index, and the
route merges both lists. Ours: 18 files, 83 tests passed.

:::quiz{id="why-rrf" xp=20}
Why merge the two result lists by rank instead of adding their scores?

- [ ] Ranks are faster to compute
  Not quite. Both are cheap. The problem is what the scores mean.
- [x] bm25 and cosine scores aren't on the same scale, but positions are comparable
  Right. "Second here, first there" means the same thing in both lists.
- [ ] Keyword search doesn't return scores
  Not quite. FTS5 does return a bm25 rank. It just can't be compared with a cosine score.
:::

Your code matches tag `e-05`
([changes from e-04](https://github.com/ryanyogan/klippy/compare/e-04...e-05)).

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "SQLite FTS5 extension" by="SQLite" url="https://www.sqlite.org/fts5.html"
- read "Reciprocal Rank Fusion" by="Cormack, Clarke & Büttcher" deep url="https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf"
:::
