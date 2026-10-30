---
title: "Lesson 2"
order: 2
minutes: 5
xp: 40
---

**Lesson 2** of the plain test course. It has no exercises, quizzes or checks,
so a plain POST to its complete action finishes it.

It also shows the prose blocks (decision 061):

- a bulleted list with `code` and **strong** text
- an item with a nested list:
  - one level deep
  - is all a list takes

### A subheading

1. An ordered list.
2. With a second step.

:::new
New to this: the model guesses the next piece, one at a time.

- a list inside the new depth
- with two items

```
a plain sample: no language
```
:::

:::engineer
Engineer: each step samples one token from the next-token distribution.

```ts
const next = sample(logits, { temperature: 1 })
```
:::
