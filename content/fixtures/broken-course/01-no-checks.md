---
title: A prompt with no checks
order: 1
minutes: 5
xp: 20
---

This lesson's first prompt forgot its checks, and the second one's regex doesn't compile.

:::prompt{id="no-checks" xp=20}
Write anything.
:::

:::prompt{id="bad-regex" xp=0}
Write anything else.

- check "Broken regex" /(unclosed/i
:::
