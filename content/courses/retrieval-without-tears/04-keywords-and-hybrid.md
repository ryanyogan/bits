---
# sources (checked 2026-10-27):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): embeddings can miss exact
#   matches like "Error code TS-999"; BM25 builds on TF-IDF with length normalisation and
#   term-frequency saturation; combine both with rank fusion; "Embeddings+BM25 is better than
#   embeddings on their own"
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Cloudflare, AI Search: Search modes and Hybrid search (vector, keyword (BM25) and hybrid;
#   new instances use hybrid by default; fusion_method "rrf" is the default)
#   https://developers.cloudflare.com/ai-search/concepts/search-modes/
# - Cormack, Clarke & Büttcher, Reciprocal Rank Fusion outperforms Condorcet and individual
#   rank learning methods (SIGIR 2009): score = sum of 1 / (k + rank), k = 60
#   https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
# The compare toy is illustrative.
title: "Keywords, and why hybrid wins"
order: 4
minutes: 8
xp: 60
module: Finding the right bits
---

Embeddings are great at meaning and surprisingly bad at **exact strings**.
Ask about “error E-417” and an embedding search happily returns a page about
errors in general. It knows the topic. It doesn't care which code.

The old fix still works: **keyword search**. The standard scoring method is
**BM25**. It scores a chunk higher when it contains the query's words, gives
**rare** words more weight than common ones (a match on “E-417” counts for
far more than a match on “the”), gives less and less credit for each repeat
of a word, and evens out long and short chunks.

Each method fails where the other shines:

:::compare{left="Embeddings only" right="Keywords (BM25) only" illustrative}
- prompt "Error E-417 on my e-bike display"
- left "Battery troubleshooting: if your display shows a warning, charge the battery fully and restart the bike."
- right "E-417: motor sensor fault. Unplug the sensor cable, check the pins, and plug it back in."
- prompt "my bike won't start"
- left "Power issues: if the e-bike doesn't switch on, check the battery is seated and charged."
- right "Starting a return: log in, open your order and choose ‘Start return’."
:::

Embeddings miss the exact code. Keywords match the word “start” and
miss the meaning. So use **both**.

---

**Hybrid search** runs both searches and merges the two ranked lists. You
can't just add the scores: BM25 scores have no fixed range, and cosine
scores sit between −1 and 1. So you merge by **rank** instead.

The usual method is **reciprocal rank fusion** (RRF). Each chunk gets
1 ÷ (60 + its rank) from every list it appears in, and you add those up. A
chunk that's high in both lists beats one that tops only one. The 60 comes
from the paper that introduced it; it stops the top spot from dominating.

:::code{file="fuse.ts" lang="ts" copy highlight="5-7" label="1 ÷ (60 + rank)"}
// Merge ranked lists of chunk ids (best first) with reciprocal rank fusion.
export function fuse(lists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

console.log(fuse([
  ["battery", "sensor", "power"],  // embeddings
  ["sensor", "returns", "battery"], // keywords
]));
:::

:::terminal{cmd="npx tsx fuse.ts"}
[ion][ 'sensor', 'battery', 'returns', 'power' ]
:::

“sensor” was second and first, so it wins. “battery” was first and third,
so it comes second. Each of the others showed up in only one list. Anthropic's tests found embeddings plus BM25 beat
embeddings alone, and Cloudflare's managed **AI Search** uses hybrid search
with RRF by default (as of October 2026).

:::quiz{id="which-search" xp=20}
A user searches your docs for `ERR_TLS_CERT_ALTNAME_INVALID`. Which search is most likely to find the page that names it?

- [x] Keyword search (BM25)
  Right. It's a rare, exact string, and that's what BM25 rewards most.
- [ ] Embedding search
  Not quite. Embeddings get the gist (some certificate error) but can rank a general page above the exact one.
- [ ] Neither can find exact strings
  Not quite. Exact strings are keyword search's home turf.
:::

:::quiz{id="why-rank" xp=20}
Why does hybrid search merge by rank instead of adding the two scores?

- [ ] Ranks are faster to compute
  Not quite. Both are cheap. The problem is what the scores mean.
- [x] The two scores are on different scales, so adding them lets one drown the other
  Right. A BM25 score of 14 and a cosine of 0.8 can't be added fairly. Ranks put both lists on the same footing.
- [ ] BM25 doesn't produce scores
  Not quite. It does, but they have no fixed range.
:::

Hybrid search works best when each half gets a query it can use. Many
retrieval systems have the model write those queries. Your turn: a customer
writes “My display keeps flashing E-417 every time I start a ride, what do I
do??”. Ask Claude for one query for keyword search and one for embedding
search, as JSON.

:::prompt{id="two-queries" xp=20 coach}
Get Claude to write a keyword query and a meaning query for one question
- goal "Get Claude to turn the customer's message into two search queries, as JSON: one that keeps the exact error code for keyword search, one in plain words for embedding search"
- placeholder "Customer message: “…” Write two search queries as JSON: keywords (for BM25: …) and meaning (for embeddings: …). JSON only."
- draft "Search for: My display keeps flashing E-417 every time I start a ride, what do I do??"
- check "Keeps the customer's message" /E-417/
- check "Keeps the customer's message" /display/i
- check "Asks for a keyword query" /keyword|bm25/i
- check "Asks for a meaning query" /meaning|semantic|embedding/i
- expect "Has both queries" json keys=keywords,meaning
- expect "The keyword query keeps E-417" match /E-417/
- rubric "The keywords query keeps the exact code E-417 and drops filler words" must evidence
- rubric "The meaning query says what the problem is in plain words, so it works without the code" must evidence
- hint "Which part of the message would an embedding search blur, and which part would keyword search miss?"
- hint "Name the two searches and what each is good at, and ask for the JSON keys you want."
- hint "Ask for {\"keywords\": …, \"meaning\": …}: keywords keeps exact codes and product words, meaning describes the problem in plain words. JSON only."
- reference "A customer wrote: “My display keeps flashing E-417 every time I start a ride, what do I do??”\n\nWrite two search queries for our help docs. keywords: for keyword (BM25) search, keep exact codes and product words and drop filler. meaning: for embedding search, describe the problem in plain words. Reply with only a JSON object with the keys keywords and meaning."
- run temperature=[1.0]
- example T=1.0 "{ \"keywords\": \"E-417 display error start ride\", \"meaning\": \"e-bike display shows an error code when starting a ride\" }"
- example T=1.0 "{ \"keywords\": \"E-417 error code display\", \"meaning\": \"error message flashing on the bike's screen when I start riding, how to fix it\" }"
- success "Exact words for keywords, plain meaning for embeddings: each half gets what it's good at." next="Next: contextual retrieval →"
:::

:::rabbithole
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
- read "AI Search: search modes" by="Cloudflare" url="https://developers.cloudflare.com/ai-search/concepts/search-modes/"
- read "Reciprocal Rank Fusion" by="Cormack, Clarke & Büttcher" deep url="https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf"
:::
