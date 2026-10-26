---
# sources (checked 2026-10-26):
# - Vaswani et al., Attention Is All You Need (2017): the transformer and its attention layers
#   https://arxiv.org/abs/1706.03762
# - 3Blue1Brown, Attention in transformers, step-by-step (Deep Learning Chapter 6):
#   many heads per layer, many layers, causal masking (a token only looks back)
#   https://www.youtube.com/watch?v=eMlx5fFNoYc
# - Anthropic, Models overview (Claude Haiku 5.5 context window: 1M tokens)
#   https://platform.claude.com/docs/en/models/overview
# - Anthropic, Glossary ("Context window": the model's working memory)
#   https://platform.claude.com/docs/en/about-claude/glossary
# Toy: weights are illustrative, one made-up head; real ones are spread over many heads and layers.
title: "Attention: how it keeps track"
order: 6
minutes: 6
xp: 40
module: How it got this way
---

To guess the next token well, the model has to know what the earlier ones
**mean here**. “Bank” by a river isn't “bank” with a vault. And “it” could be
almost anything.

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

---

The real thing is messier. A model runs many attention **heads** side by side,
each free to track something different (who did what, what a word refers to,
which bracket is still open). Then it stacks many of these layers, so later
layers build on what earlier ones worked out.

Attention also explains the **context window**: the stretch of text the model
can look back over. Claude Haiku 5.5's is 1M tokens, per Anthropic's models
overview (October 2026). Anything outside it, the model simply can't see.

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
