---
# sources (checked 2026-10-27):
# - Anthropic, Embeddings (voyage-4, input_type, normalised vectors, https://ai.mongodb.com/v1)
#   https://platform.claude.com/docs/en/build-with-claude/embeddings
# - Voyage AI, Reranker API (POST /v1/rerank: query, documents, model, top_k -> data[] of
#   { index, relevance_score })
#   https://docs.voyageai.com/docs/reranker
# - Anthropic, Search results (search_result blocks with citations)
#   https://platform.claude.com/docs/en/build-with-claude/search-results
# - Cloudflare, Vectorize: Limits (max 1536 dimensions; topK up to 50 with values or metadata,
#   100 without; 10 KiB metadata per vector; 64-byte vector ids) and Get started with embeddings
#   (dimensions and metric are fixed when the index is created)
#   https://developers.cloudflare.com/vectorize/platform/limits/
#   https://developers.cloudflare.com/vectorize/get-started/embeddings/
# - Cloudflare, AI Search overview (managed indexing and search; hybrid by default)
#   https://developers.cloudflare.com/ai-search/
# The terminal output is example output, not a live run.
title: "Checkpoint: ask my docs"
order: 9
minutes: 10
xp: 80
module: Answering with sources
project: true
---

Time to put the whole course together: a tiny **“ask my docs”** tool in
TypeScript. Point it at a folder of Markdown files, ask a question, get an
answer with sources. About 80 lines, plus `chunk.ts` from lesson 2 and
`answer.ts` from lesson 7.

It runs in two steps. **Index** once: chunk every file, embed the chunks,
save them. **Ask** as often as you like: embed the question, shortlist the
50 closest chunks, rerank them down to 5, and hand those to Claude as search
results with citations on.

:::code{file="index.ts" lang="ts" copy}
import { readdir, readFile, writeFile } from "node:fs/promises";
import { chunk, type Chunk } from "./chunk";
import { embed } from "./voyage";

async function main() {
  const dir = process.argv[2] ?? "docs";
  const chunks: Chunk[] = [];
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".md")) continue;
    chunks.push(...chunk(file, await readFile(`${dir}/${file}`, "utf8")));
  }

  // Embed in batches of 100 chunks per request.
  const vectors: number[][] = [];
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100).map((c) => c.text);
    vectors.push(...(await embed(batch, "document")));
  }

  const index = chunks.map((c, i) => ({ ...c, vector: vectors[i]! }));
  await writeFile("index.json", JSON.stringify(index));
  console.log(`Indexed ${index.length} chunks from ${dir}/`);
}

main();
:::

:::code{file="voyage.ts" lang="ts" copy}
const BASE = "https://ai.mongodb.com/v1"; // Voyage via MongoDB Atlas

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Voyage ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function embed(texts: string[], inputType: "query" | "document") {
  const json = await post<{ data: { embedding: number[] }[] }>("/embeddings", {
    input: texts, model: "voyage-4", input_type: inputType,
  });
  return json.data.map((d) => d.embedding);
}

export async function rerank(query: string, documents: string[], topK: number) {
  const json = await post<{ data: { index: number; relevance_score: number }[] }>("/rerank", {
    query, documents, model: "rerank-3", top_k: topK,
  });
  return json.data; // best first
}
:::

The ask step searches, then answers. `answer.ts` is the one from lesson 7.

:::code{file="search.ts" lang="ts" copy highlight="12-20" label="retrieve wide, rerank narrow"}
import { readFile } from "node:fs/promises";
import type { Chunk } from "./chunk";
import { embed, rerank } from "./voyage";

type Entry = Chunk & { vector: number[] };

export async function search(question: string, topK = 5) {
  const index = JSON.parse(await readFile("index.json", "utf8")) as Entry[];
  const [q] = await embed([question], "query");
  const similarity = (v: number[]) => v.reduce((sum, x, i) => sum + x * q![i]!, 0);

  // Retrieve wide: the 50 closest chunks (dot product = cosine for Voyage).
  const shortlist = index
    .map((entry) => ({ entry, score: similarity(entry.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map(({ entry }) => entry);
  // Rerank narrow: keep the best few.
  const ranked = await rerank(question, shortlist.map((e) => e.text), topK);
  return ranked.map((r) => shortlist[r.index]!);
}
:::

:::code{file="ask.ts" lang="ts" copy}
import { search } from "./search";
import { answer } from "./answer";

async function main() {
  const question = process.argv[2];
  if (!question) throw new Error('Usage: npx tsx ask.ts "your question"');
  const hits = await search(question);
  await answer(question, hits.map((h) => ({ source: h.id, title: h.source, text: h.text })));
}

main();
:::

You need two keys: one for Claude and a Voyage model API key from MongoDB
Atlas.

:::code{file=".env.example" lang="env" copy}
# Claude: console.anthropic.com · Voyage: a model API key from MongoDB Atlas
ANTHROPIC_API_KEY=sk-ant-…
VOYAGE_API_KEY=…
:::

Index once, then ask. Example output from one run (yours will differ):

:::terminal{cmd='npx tsx --env-file=.env index.ts docs && npx tsx --env-file=.env ask.ts "How long is the battery warranty?"' summary="example output, not a live run"}
[quiet]Indexed 42 chunks from docs/
E-bike batteries have a 2-year warranty from delivery, covering capacity that drops below 70%. File any claim within 30 days of noticing the fault.
[ion]Sources:
[quiet]warranty.md (warranty.md#0)
[quiet]warranty.md (warranty.md#1)
:::

---

**Taking it to production on Cloudflare.** `index.json` is fine for a few
thousand chunks. Past that, swap it for **Vectorize**, Cloudflare's vector
database. Create the index with the same shape as your vectors, because
dimensions and metric can't change later.

:::code{file="vectorize.sh" lang="sh" copy}
npx wrangler vectorize create docs \
  --dimensions=1024 --metric=cosine
:::

Upsert each chunk with its id, vector and a little metadata (source, text),
then query it with `topK`. Limits to plan for (as of October 2026): 1,536
dimensions at most, 10 KiB of metadata per vector, ids up to 64 bytes, and
`topK` up to 50 when you ask for metadata back. Or skip the plumbing:
Cloudflare's **AI Search** indexes your files and runs hybrid search for
you.

What's next for this pipeline is everything you just learned: add BM25 and
fuse the two lists (lesson 4), add context to each chunk (lesson 5), and
write twenty test questions to measure each change (lesson 8).

:::quiz{id="pipeline-order" xp=20}
In `search.ts`, why does the code shortlist 50 chunks before calling `rerank`?

- [ ] Vectorize can't return more than 50
  Not quite. This version doesn't use Vectorize at all; it's a choice, not a limit.
- [x] Reranking every chunk on every question would be slow and costly, so the cheap search narrows the field first
  Right. Retrieve wide and cheap, then rerank narrow and careful.
- [ ] Claude can only read 50 search results
  Not quite. Claude only ever sees the top 5 here. The 50 are for the reranker.
:::

---

Last step, and the one that decides how the answers feel: the instructions
that go with the search results. Write the prompt for **Orbit Bikes' docs
assistant**. The passages and a customer question are in the box. Tell
Claude who it is, to answer **only from the passages**, to **cite** them
like `[1]`, to **say plainly** what the passages don't cover, and to keep it
**short**. Run it a few times. The answer should change its words, never its
facts.

:::prompt{id="ask-my-docs" xp=60}
Write the instructions for a grounded, cited docs assistant

- placeholder "You are Orbit Bikes' docs assistant. Answer only from the passages… Cite… If they don't cover it… Keep it under… words."
- draft "[1] warranty.md: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. [2] warranty.md: Claims must be filed within 30 days of noticing the fault, with the order number and a photo of the battery label. [3] returns.md: You can return any bike within 30 days of delivery for a full refund, if it has under 50 km on the odometer. Customer question: My battery is 20 months old and now gets half the range. What do I need to send you, and can I get a loaner bike while it's fixed?"
- check "Gives it a role"                    /you are|you're|act as|\brole\b|assistant/i
- check "Limits Claude to the passages"      /\bonly\b|based on|according to|nothing else|solely|strictly/i
- check "Asks for citations"                 /\bcite|citation|\bsources?\b|reference/i
- check "Says what to do when it's missing"  /don.t (know|cover|say|mention)|not (in|covered|mentioned)|isn.t (in|covered)|say so|plainly|admit|can.t find|cannot find/i
- check "Keeps it short"                     /\bwords?\b|\bsentences?\b|\bshort\b|\bbrief\b|\bconcise\b/i
- run temperature=[1.0]
- example T=1.0 "Your battery is still under the 2-year warranty, and losing half its range suggests capacity below 70% [1]. Send your order number and a photo of the battery label within 30 days of noticing the fault [2]. The docs don't mention loaner bikes, so I can't promise one."
- example T=1.0 "You're covered: batteries have a 2-year warranty for capacity below 70% [1]. To claim, send your order number and a photo of the battery label, within 30 days of spotting the problem [2]. I couldn't find anything about loaner bikes in our docs."
- success "Grounded, cited, short, and honest about the gap. That's RAG without tears." next="Finish the course →"
:::

Finish this checkpoint and the **Retrieval without tears** badge is yours.
You can now decide when to paste and when to search, find the right
passages three ways, hand them to Claude with sources, and prove each change
helped.

:::rabbithole
- read "Vectorize: get started with embeddings" by="Cloudflare" url="https://developers.cloudflare.com/vectorize/get-started/embeddings/"
- read "AI Search" by="Cloudflare" url="https://developers.cloudflare.com/ai-search/"
- read "Search results" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/search-results"
:::
