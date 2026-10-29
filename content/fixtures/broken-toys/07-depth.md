---
title: Broken depth blocks
order: 7
minutes: 5
xp: 0
---

A graded block inside a depth, a nested depth, and a toy that closes its depth block early.

::::new
Brand new.

:::prompt{id="inside-depth" xp=10}
Write a prompt.
- check "Says hi" /hi/i
:::
::::

::::engineer
:::new
Nested.
:::
::::

:::new
Brand new again.

:::nexttoken{prompt="x"}
" a" 0.5
:::

Leaked.
:::

::::engineer
:::rabbithole
- read "Docs" by="Anthropic" url="https://docs.anthropic.com"
:::
::::
