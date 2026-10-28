---
# sources (checked 2026-10-27):
# - Anthropic, Embeddings (Anthropic has no embedding model and points to Voyage AI by
#   MongoDB; voyage-4-large / voyage-4 / voyage-4-lite, 1024 dimensions by default, 32,000-token
#   inputs; input_type "query" vs "document"; Voyage vectors are normalised, so dot product
#   equals cosine similarity; HTTP API at https://ai.mongodb.com/v1/embeddings)
#   https://platform.claude.com/docs/en/build-with-claude/embeddings
# - Voyage AI, The Voyage 4 model family (2026-01-15): the voyage-4 models share one embedding
#   space, so their vectors can be mixed; other model families don't
#   https://blog.voyageai.com/2026/01/15/voyage-4/
# - 3Blue1Brown, Transformers, the tech behind LLMs (word embeddings as directions in space)
#   https://www.youtube.com/watch?v=wjZofJX0v4M
# The 3-number vectors are made up by hand; the terminal shows what that toy code prints.
title: "Embeddings and similarity"
order: 3
minutes: 7
xp: 40
module: Finding the right bits
---

“How do I get my money back?” and “Refund policy” share **no words**, yet
they're about the same thing. Search by meaning needs a way to see that.

An **embedding model** turns a piece of text into a list of numbers, called
a **vector**. It's trained so that texts with similar meaning get similar
vectors. You embed every chunk once, ahead of time. At question time you
embed the question and look for the chunks whose vectors sit closest to it.

“Closest” is usually **cosine similarity**: how closely two vectors point the
same way. 1 means the same direction, 0 means unrelated.

---

Here's a toy you can run. Real vectors have about a thousand numbers; these
have three, **made up by hand** so the idea is easy to see. Think
of the three numbers as “about money”, “about delivery” and “about pets”.

:::code{file="toy.ts" lang="ts" copy highlight="9-15" label="cosine similarity"}
// Hand-made 3-number "embeddings", for illustration only.
const chunks: Record<string, number[]> = {
  "Refund policy": [0.9, 0.1, 0.0],
  "Shipping times": [0.1, 0.9, 0.1],
  "Office dog rules": [0.0, 0.2, 0.9],
};
const question = [0.8, 0.3, 0.1]; // "How do I get my money back?"

function cosine(a: number[], b: number[]) {
  let dot = 0, lenA = 0, lenB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!; lenA += a[i]! ** 2; lenB += b[i]! ** 2;
  }
  return dot / Math.sqrt(lenA * lenB);
}

for (const [title, vector] of Object.entries(chunks)) {
  console.log(cosine(question, vector).toFixed(2), title);
}
:::

:::terminal{cmd="npx tsx toy.ts"}
[volt]0.96[quiet] Refund policy
[volt]0.46[quiet] Shipping times
[volt]0.19[quiet] Office dog rules
:::

The refund chunk wins without sharing a single word with the question. In a
real model, nobody chooses what the numbers mean. The model learns them, and
they don't map to neat labels like “money”.

:::quiz{id="cosine-means" xp=10}
A chunk scores 0.96 against the question. What does that tell you?

- [ ] The chunk is 96% likely to be correct
  Not quite. It's a closeness score, not a probability or a fact check.
- [x] The model thinks the two texts mean nearly the same thing
  Right. High similarity means close in meaning. Whether the chunk actually answers the question is a separate matter.
- [ ] 96% of the words match
  Not quite. Embeddings compare meaning, not words. These two share none.
:::

---

**Which model?** Anthropic doesn't make an embedding model. Its docs point to
**Voyage AI** (now part of MongoDB). As of October 2026 the general-purpose
family is `voyage-4-large` (best quality), `voyage-4` (balanced) and
`voyage-4-lite` (fastest and cheapest). They return 1,024 numbers by
default. Shop around if you like; Anthropic's docs say to compare vendors on
your own data.

Two rules for real use. Tell the model whether it's embedding a **query** or
a **document** (`input_type`), because it embeds them slightly differently
to make questions match answers. And **use one model family for everything**:
vectors from different families live in different spaces, so comparing them
gives nonsense. (The voyage-4 models share one space, which is unusual.)

:::code{file="voyage.ts" lang="ts" copy}
// Voyage's Embedding API, via MongoDB Atlas. Needs VOYAGE_API_KEY.
export async function embed(texts: string[], inputType: "query" | "document") {
  const res = await fetch("https://ai.mongodb.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: "voyage-4", input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding); // one 1,024-number vector per text
}
:::

Voyage's vectors come out with length 1, so a plain dot product gives the
same answer as cosine similarity, a little faster.

:::quiz{id="mixed-models" xp=20}
Your index was built with `voyage-3.5`. You switch the query side to a newer model from a different family, with the same 1,024 numbers. What happens?

- [ ] It errors, because the models don't match
  Not quite. The vectors are the same length, so the maths runs fine. That's the trap.
- [x] Search quietly returns poor matches
  Right. The numbers mean different things in each model, so the scores are meaningless. Re-embed the documents when you change models.
- [ ] Search gets better, because the query model is newer
  Not quite. A better model only helps when both sides use it.
:::

:::rabbithole
- read "Embeddings" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/embeddings"
- video "Transformers, the tech behind LLMs" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
:::
