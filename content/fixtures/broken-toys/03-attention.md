---
title: Broken attention
order: 3
minutes: 5
xp: 0
---

An index out of range, a token looking ahead, a weight over 1 and a duplicate.

:::attention
tokens "The" " animal" " was" " tired"
- from=4 to=1 w=0.5
- from=1 to=3 w=0.5
- from=3 to=1 w=1.5
- from=3 to=1 w=0.6
- from=3 to=1 w=0.2
:::
