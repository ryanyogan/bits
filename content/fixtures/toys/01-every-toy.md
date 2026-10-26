---
title: Every toy
order: 1
minutes: 6
xp: 0
illustrative: true
---

A model writes one token at a time. Watch the reply form.

:::nexttoken{prompt="The capital of France is"}
" Paris" 0.92 | " the":0.03 " a":0.02
"." 0.71 | ",":0.2 " and":0.05
" It" 0.4 | " The":0.3 "\n":0.1
:::

It learns by guessing, over and over.

:::training{prompt="Once upon a"}
- step 0 loss=10.8 "qz# lorp vv kk"
- step 500 loss=6.1 "the the a of time"
- step 5,000 loss=3.2 "time there was a"
- step 50000 loss=1.9 "time, there lived a fox."
:::

Attention lets each token look back.

:::attention{caption="What does “it” refer to?"}
tokens "The" " animal" " didn't" " cross" " the" " street" " because" " it" " was" " tired"
- from=7 to=1 w=0.62
- from=7 to=5 w=0.2
- from=7 to=7 w=0.1
- from=9 to=1 w=0.5
- from=9 to=7 w=0.3
:::

Same prompt, two models.

:::compare{left="Base model" right="Assistant" illustrative=false}
- prompt "What is the capital of France?"
- left "What is the capital of Germany?
  What is the capital of Spain?"
- right "The capital of France is Paris."
:::

:::rabbithole
- video "But what is a GPT?" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
- video "Let's build GPT: from scratch, in code, spelled out." by="Andrej Karpathy" mins=116 url="https://www.youtube.com/watch?v=kCc8FmEb1nY"
- read "Tracing the thoughts of a large language model" by="Anthropic" url="https://www.anthropic.com/research/tracing-thoughts-language-model"
:::
