---
# sources (checked 2026-10-27):
# - Anthropic, Introducing Contextual Retrieval (2024-09-19): evaluated with 1 minus
#   recall@20 (the share of relevant chunks missing from the top 20); "always run evals"
#   https://www.anthropic.com/engineering/contextual-retrieval
# - Anthropic, Retrieval augmented generation (cookbook): evaluates retrieval (precision,
#   recall, MRR) separately from end-to-end answer accuracy
#   https://platform.claude.com/cookbook/capabilities-retrieval-augmented-generation-guide
# - Anthropic, Define success criteria and build evaluations
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# The terminal numbers are made up for illustration.
title: "Measuring retrieval"
order: 8
minutes: 7
xp: 50
module: Answering with sources
---

You've now got a lot of dials: chunk size, overlap, embedding model, BM25 or
not, contextual chunks, reranking, how many results to keep. Without a
number, you're tuning by vibes.

The good news: you can measure retrieval **on its own**, before Claude
writes a word. If the right chunk never reaches the prompt, no prompt can
save the answer.

---

The measure is **recall@k**. Write down a set of real questions, and for
each one, the chunk that answers it. Run your search. Recall@k is the share
of questions where that chunk shows up in the **top k** results.

Twenty questions, right chunk in the top 5 for seventeen of them: recall@5
is 17 ÷ 20 = **0.85**. Anthropic's contextual retrieval tests used exactly
this, at k = 20, and reported the misses (1 − recall@20).

:::code{file="eval.ts" lang="ts" copy highlight="9-13" label="hit if the chunk is in the top k"}
type Case = { question: string; answerId: string }; // the chunk that answers it

export async function recallAt(
  k: number,
  cases: Case[],
  search: (q: string) => Promise<string[]>, // returns chunk ids, best first
) {
  let hits = 0;
  for (const c of cases) {
    const ids = await search(c.question);
    if (ids.slice(0, k).includes(c.answerId)) hits++;
    else console.log(`miss: ${c.question}`);
  }
  return hits / cases.length;
}
:::

Run it once per setup, and keep the misses: reading why a question missed
teaches you more than the score. Here's the kind of table you're after
(illustrative numbers):

:::terminal{cmd="npx tsx eval.ts" summary="illustrative numbers, not a real run"}
[quiet]setup                         recall@5  recall@20
[ion]embeddings only              [volt]  0.70      0.85
[ion]+ BM25 (hybrid)              [volt]  0.80      0.90
[ion]+ contextual chunks          [volt]  0.85      0.95
[ion]+ rerank top 150             [volt]  0.90      0.95
:::

A few tips. **Twenty to fifty questions** is plenty to start, as long as
they're real: pull them from support tickets or search logs. **Phrase them
like users do**, not by copying the chunk's wording, or keyword search will
look better than it is. And **check answers separately**: high recall with
bad answers means the problem is in the prompt, not the search.

:::quiz{id="recall-math" xp=20}
You have 10 test questions. The right chunk is in the top 3 for 6 of them, and in the top 10 for 9. What's recall@3?

- [x] 0.6
  Right. 6 of 10 questions had their chunk in the top 3.
- [ ] 0.9
  Not quite. That's recall@10.
- [ ] 0.3
  Not quite. Recall counts questions, not result slots: 6 hits out of 10 questions.
:::

:::quiz{id="where-is-the-bug" xp=10}
Recall@20 is 0.95, but users say the answers are often wrong. Where do you look first?

- [ ] The embedding model
  Not quite. Search is finding the right chunk 95% of the time.
- [x] The answer step: the prompt, the number of chunks, and how they're presented
  Right. Retrieval is doing its job, so the trouble starts after it. Check what Claude is told to do with the chunks.
- [ ] Chunk size
  Not quite. With recall that high, chunking is working.
:::

No test questions yet? Claude can draft them. Your turn: ask for **five
questions** a customer might ask that this passage answers, **phrased the way
customers talk**, not copied from the passage.

:::prompt{id="draft-test-questions" xp=20}
Get Claude to draft retrieval test questions

- placeholder "Here is a passage: … Write 5 questions a customer might ask that it answers. Use … words, not the passage's."
- draft "Passage: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault."
- check "Asks for questions"            /questions/i
- check "Sets how many"                 /\b(3|4|5|6|three|four|five|six)\b/i
- check "Asks for customers' own words" /own words|customer|everyday|casual|natural|plain|paraphras|not cop|don.t cop|different words|avoid/i
- run temperature=[1.0]
- example T=1.0 "1. My e-bike battery doesn't hold a charge like it used to. Is that covered?\n2. How long is the battery guaranteed for?\n3. I bought my bike last year and the range has dropped a lot. Can I get a new battery?\n4. Is there a deadline to report a battery problem?\n5. What counts as a faulty battery?"
- success "Real-sounding questions make an honest test." next="Next: the checkpoint →"
:::

:::rabbithole
- read "Retrieval augmented generation (cookbook)" by="Anthropic" url="https://platform.claude.com/cookbook/capabilities-retrieval-augmented-generation-guide"
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
:::
