---
# sources (checked 2026-10-29):
# - Vaswani et al., Attention Is All You Need (2017): the transformer and its attention layers
#   https://arxiv.org/abs/1706.03762
# - 3Blue1Brown, Attention in transformers, step-by-step (Deep Learning Chapter 6):
#   queries, keys and values; many heads per layer, many layers; causal masking (a token only
#   looks back); the cost of attention growing with the length of the context
#   https://www.youtube.com/watch?v=eMlx5fFNoYc
# - Anthropic, Models overview (prompt cache reads cost 10% of the base input price)
#   https://platform.claude.com/docs/en/models/overview
# Toy: weights are illustrative, one made-up head; real ones are spread over many heads and layers.
title: "Attention: how it keeps track"
order: 7
minutes: 6
xp: 40
module: How it got this way
---

Last lesson: everything the model can use is in one long text. This lesson:
how it reads that text. To guess the next token well, the model has to know
what the earlier ones **mean here**. “Bank” by a river isn't “bank” with a
vault. And “it” could be almost anything.

---

:::new
The part of the model that sorts this out is called **attention**. It's the
big idea inside the **transformer**, the design almost every modern LLM uses,
Claude included.

---

Here's the intuition. At each token, the model asks: **which earlier tokens
matter for me?** It gives each one a weight, then blends in information from
the ones with the most weight. Only earlier tokens, never later ones: it's
writing left to right.

Click a word below to see what it looks back at. These weights are
illustrative, made up to show one clean pattern.
:::

:::engineer
The mechanism is **attention**, the core of the **transformer** architecture
(Vaswani et al., 2017) that Claude and nearly every current LLM are built on.

---

Each token's vector produces a **query**, a **key** and a **value**. A
token's query is scored against every earlier token's key; softmax turns the
scores into weights; the token's representation is updated with the weighted
sum of those tokens' values. A **causal mask** hides later positions, so
each token only attends backwards, which is what makes left-to-right
generation work. The result is that “it” can carry the meaning of “animal”
into its own position before the next-token prediction is made.

Below is one head on one sentence, with made-up weights chosen to show a
clean pattern.
:::

:::attention{caption="Which earlier words does “it” look at?" illustrative}
tokens "The" " animal" " didn't" " cross" " the" " street" " because" " it" " was" " tired"
- from=7 to=1 w=0.62
- from=7 to=5 w=0.18
- from=7 to=0 w=0.06
- from=9 to=1 w=0.41
- from=9 to=7 w=0.33
- from=9 to=8 w=0.12
- from=5 to=3 w=0.47
- from=5 to=4 w=0.29
- from=3 to=1 w=0.55
- from=3 to=2 w=0.30
:::

“It” leans hard on “animal”, so the model treats “it” as the animal. Swap
“tired” for “wide” and a good model's “it” would lean towards “street”
instead.

:::new

The real thing is messier. A model runs many attention **heads** side by side,
each free to track something different (who did what, what a word refers to,
which bracket is still open). Then it stacks many of these layers, so later
layers build on what earlier ones worked out.

This is where the context window gets used. Attention is how the model reads
across everything in it, your system prompt and old turns included. Every new
token looks back over all the earlier ones, so the longer the text, the more
looking there is to do. That's one reason long prompts cost more and run
slower.
:::

:::engineer

Real models run many **heads** per layer in parallel, each with its own
query/key/value projections, so different heads can specialise (coreference,
syntax, which delimiter is open), and stack dozens of layers, each attending
over the previous layer's output. The clean single-head picture above is a
simplification of a very wide, very deep version of the same operation.

This is the mechanism that reads the context window. Every token in the
window is a key and a value for every later token, so the work grows with
the length of the context, and the keys and values for the whole prefix have
to exist before the first output token. Two engineering consequences. Long
prompts cost more and have higher time-to-first-token. And a prefix that
doesn't change between calls (system prompt, documents, tool definitions)
should be prompt-cached: on Claude, cache reads cost 10% of the input price,
and the cached prefix's computation is reused rather than redone.
:::

Your turn. Write a sentence where a word like “it” could point two ways, and
ask Claude what it refers to. Then swap one word and run it again.

:::prompt{id="what-does-it-mean" xp=40}
Give Claude a sentence with a tricky “it”, then ask what “it” refers to

- placeholder "The trophy didn't fit in the suitcase because it was too big. What does “it” refer to?"
- draft "The trophy didn't fit in the suitcase because it was too big."
- check "Has a word like “it”"        /\b(it|they|them|she|he|this)\b/i
- check "Asks what it refers to"      /refers? to|stands? for|\bmeans?\b|points? to/i
- run temperature=[1.0]
- example T=1.0 "“It” refers to the trophy. The trophy was too big to fit in the suitcase."
- example T=1.0 "Here “it” means the trophy: it's the thing that was too big."
- example T=1.0 "The trophy. Something too big is what stops it fitting, so “it” has to be the trophy, not the suitcase."
- success "Change one word and the answer can flip. That's context at work." next="Next: what it can't do →"
:::

:::rabbithole
- video "Attention in transformers, step-by-step" by="3Blue1Brown" mins=26 url="https://www.youtube.com/watch?v=eMlx5fFNoYc"
:::
