---
title: Two depths
order: 3
minutes: 6
xp: 10
illustrative: true
---

This turn is shared: both depths read it.

:::new
A model reads text in small pieces called **tokens**, a bit like syllables.
:::

::::engineer
Tokens are subword units from a byte-pair vocabulary of about 100k entries.

:::nexttoken{prompt="The capital of France is"}
" Paris" 0.92 | " the":0.03 " a":0.02
" ." 0.71 | ",":0.2
:::

The odds above are one forward pass each.
::::

:::ask{id="depth-shared" xp=10}
What does a model read?
- choice "Tokens" correct "Yes: pieces of text."
- choice "Letters" "Not one at a time."
:::

Shared again after the check.
