---
# sources (checked 2026-10-27):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): retrieve the top 150, rerank,
#   keep the top 20; reranked contextual embeddings + contextual BM25 cut the top-20 failure
#   rate by 67% (5.7% -> 1.9%); reranking adds latency and cost, so tune how many you rerank
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Voyage AI by MongoDB, Rerankers (rerankers are cross-encoders that read the query and
#   document together; rerank-3 "highest accuracy", rerank-3-lite for latency and cost)
#   https://www.mongodb.com/docs/voyageai/models/rerankers/
# - Anthropic, Embeddings (lists Voyage's rerankers; rerank-3 recommended for most uses)
#   https://platform.claude.com/docs/en/build-with-claude/embeddings
# - Voyage AI, Reranker API (POST /v1/rerank with query, documents, model, top_k; response
#   data[] of { index, relevance_score }, best first)
#   https://docs.voyageai.com/docs/reranker
# The compare toy and the terminal output are illustrative.
title: "Reranking"
order: 6
minutes: 8
xp: 60
module: Finding the right bits
---

Embedding search is fast because it does the hard work **ahead of time**.
Every chunk was turned into a vector once; at question time you only embed
the question and compare numbers. The price: the model never reads the
question and the chunk **together**. It's matching two summaries.

A **reranker** does read them together. You give it the question and a
list of candidate chunks, and it scores each pair, with the whole question
in view. That's more accurate, and much slower per chunk, so you can't run it
over your whole library. You run it on a shortlist.

---

The pattern is **retrieve wide, then rerank narrow**. Anthropic's setup
pulled the top **150** chunks with hybrid search, reranked them, and kept the
top **20** for Claude. Adding that step took the miss rate from 2.9% to
**1.9%**. All together, contextual retrieval plus reranking cut misses by
two thirds from where plain embeddings started.

:::compare{left="Hybrid search order" right="After reranking" illustrative}
- prompt "Can I claim on a battery that's 18 months old?"
- left "1. Frames: lifetime warranty for the first owner.\n2. Battery care: store at 40–60% charge in winter.\n3. E-bike batteries: 2-year warranty from delivery, covering capacity below 70%."
- right "1. E-bike batteries: 2-year warranty from delivery, covering capacity below 70%.\n2. Claims must be filed within 30 days of noticing the fault.\n3. Battery care: store at 40–60% charge in winter."
:::

The first list matched the words “battery” and “warranty”. The reranker
read the question, saw it was about **age and eligibility**, and moved the
2-year rule to the top.

As of October 2026, Voyage's current rerankers are `rerank-3` (most
accurate) and `rerank-3-lite` (faster and cheaper). It's one HTTP call:

:::code{file="rerank.ts" lang="ts" copy highlight="9" label="the request"}
// Rerank candidate chunks against the question. Needs VOYAGE_API_KEY.
export async function rerank(query: string, documents: string[], topK = 20) {
  const res = await fetch("https://ai.mongodb.com/v1/rerank", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ query, documents, model: "rerank-3", top_k: topK }),
  });
  if (!res.ok) throw new Error(`Voyage: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { index: number; relevance_score: number }[] };
  return json.data; // best first; index points into `documents`
}
:::

Example output for the question above (your scores will differ):

:::terminal{cmd="npx tsx try-rerank.ts" summary="example output, not a live run"}
[volt]0.91[quiet] #2 E-bike batteries: 2-year warranty from delivery…
[volt]0.62[quiet] #4 Claims must be filed within 30 days…
[volt]0.38[quiet] #1 Battery care: store at 40–60% charge…
:::

Reranking adds a network call to every question, and the bill grows with
the number of chunks you send it. Anthropic's advice: try a few shortlist
sizes on your own questions and pick the best trade-off.

:::quiz{id="why-not-rerank-all" xp=20}
A reranker is more accurate than embedding search. Why not skip embeddings and rerank your whole library for every question?

- [ ] Rerankers can only read 20 documents
  Not quite. They take long lists, but that's not the real limit.
- [x] It would score every chunk against every question, live, which is far too slow and costly
  Right. Embeddings do their heavy work once, ahead of time. A reranker has to do its work on every question, so you only feed it a shortlist.
- [ ] Rerankers don't understand meaning
  Not quite. Understanding meaning is exactly what they're good at.
:::

:::quiz{id="rerank-order" xp=20}
Put the steps in order for one question.

- [ ] Rerank everything, then run hybrid search on the top 20
  Not quite. The cheap, wide search comes first; the expensive, careful one second.
- [x] Hybrid search for ~150 candidates, rerank them, send the top ~20 to Claude
  Right. Retrieve wide and cheap, rerank narrow and careful, then answer.
- [ ] Send 150 chunks to Claude and ask it to rerank them
  Not quite. That works for small lists, but it costs far more than a reranker and adds a slow step.
:::

For a handful of candidates, Claude can do a reranker's job: read the
question with each passage and put them in order. A dedicated reranker is
faster and cheaper per chunk, which is why it wins on long lists. Your turn,
on a short one. Question: “Can I claim on a battery that's 18 months old?”

- [1] Frames: lifetime warranty for the first owner.
- [2] Battery care: store at 40–60% charge in winter.
- [3] E-bike batteries: 2-year warranty from delivery, covering capacity below 70%.
- [4] Claims must be filed within 30 days of noticing the fault.

Ask Claude to rank them for the question, best first, numbers only.

:::prompt{id="rerank-by-hand" xp=20 coach}
Get Claude to rerank four passages for one question
- goal "Get Claude to rank the four passages by how well they answer the question, best first, replying with the numbers only"
- placeholder "Question: … Passages: [1] … [2] … [3] … [4] … Rank them by how well each answers the question, best first. Reply with the numbers only, like 2, 4, 1, 3."
- draft "Which passage is best? Can I claim on a battery that's 18 months old?"
- check "Pastes the question" /18 months/i
- check "Pastes the passages" /lifetime/i
- check "Pastes the passages" /winter/i
- check "Pastes the passages" /2-year|2 year/i
- check "Pastes the passages" /30 days/i
- check "Asks for a ranking" /rank|order|sort|best first|most relevant/i
- expect "Best first: passage 3" match /^\W?3\b/
- expect "Numbers only" words<=12
- rubric "Puts passage 3, the 2-year battery warranty, first" must evidence
- rubric "Puts passage 4, the 30-day claims rule, second" should
- hint "Claude can't rank passages it can't see. Are all four, with their numbers, in your prompt?"
- hint "Ask about the question, not the topic: which passage says whether an 18-month-old battery is covered?"
- hint "Ask for the passage numbers only, best first, separated by commas, and nothing else."
- reference "Question: Can I claim on a battery that's 18 months old?\n\nPassages:\n[1] Frames: lifetime warranty for the first owner.\n[2] Battery care: store at 40–60% charge in winter.\n[3] E-bike batteries: 2-year warranty from delivery, covering capacity below 70%.\n[4] Claims must be filed within 30 days of noticing the fault.\n\nRank the passages by how well each one answers the question, best first. Reply with the passage numbers only, separated by commas."
- run temperature=[1.0]
- example T=1.0 "3, 4, 2, 1"
- example T=1.0 "3, 4, 1, 2"
- success "Read the question and the passage together: that's what a reranker adds." next="Next: answers with sources →"
:::

:::rabbithole
- read "Rerankers" by="Voyage AI by MongoDB" url="https://www.mongodb.com/docs/voyageai/models/rerankers/"
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
:::
