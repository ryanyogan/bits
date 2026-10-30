---
title: Broken flow
order: 9
minutes: 5
xp: 0
---

No capacity, an item too big, a zero, a bad line, and a window nothing leaves.

:::flow
- "system prompt" 3
- "Hi" 1
:::

:::flow{capacity=4}
- "a long document" 9
- "nothing" 0
- "Hi" one
- "Hi" 1
:::

:::flow{capacity=99}
- "a" 1
- "b" 1
:::
