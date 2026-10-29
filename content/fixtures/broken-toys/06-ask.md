---
title: Broken quick checks
order: 6
minutes: 5
xp: 0
---

No accept line or right choice, an unsafe pattern, a malformed reject, an unknown line, and two right choices without multiple.

:::ask{id="nothing-right"}
What is a token?
- choice "A letter"
- choice "A word"
:::

:::ask{id="unsafe"}
Say it.
- accept "Repeats" /a+/
- reject "Odd" /x/
- banana "x"
:::

:::ask{id="two-right"}
Pick.
- choice "A" correct
- choice "B" correct
:::
