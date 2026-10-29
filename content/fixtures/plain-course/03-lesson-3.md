---
title: "Lesson 3"
order: 3
minutes: 5
xp: 40
---

**Lesson 3** of the plain test course. It has no exercises or checks that
gate it, so a plain POST to its complete action finishes it.

Its one quick check is ungated (`gate=false`): tests answer it before or
after completing the lesson (decision 052).

:::ask{id="name-a-unit" xp=10 gate=false}
What does a model read and write, one at a time?
- placeholder "One word"
- accept "Names tokens" /\btokens?\b/i
- reject "Letters" /\bletters?\b|\bcharacters?\b/i "Smaller than words, but not single letters. What are the pieces called?"
- hint "It starts with t."
- explain "Tokens: common words and pieces of rarer ones."
:::
