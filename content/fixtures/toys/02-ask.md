---
title: Quick checks
order: 2
minutes: 5
xp: 30
---

A typed answer, graded by safe patterns on the server.

:::ask{id="typed" xp=10}
Why does a model miscount the r's in “strawberry”?
- placeholder "In a sentence"
- accept "Mentions tokens" /token|chunk|piece/i
- reject "Blames memory" /memor/i "It isn’t a memory problem. What does it see instead of letters?"
- hint "Think about what the model reads."
- explain "It reads tokens, not letters, so the r's are hidden inside chunks."
:::

Options that fill the field, with one right answer.

:::ask{id="picked" xp=10 gate=false}
Which is most likely one token?
- choice "“ the”" correct "Common words get a token of their own."
- choice "“Unbelievably”" "Rare words split into pieces."
- choice "“fetched.”"
:::

A legacy quiz compiles to the same block.

:::quiz{id="legacy" xp=10 multiple}
Which are tokens?
- [x] “ the”
- [x] “ing”
- [ ] “the whole sentence”
:::
