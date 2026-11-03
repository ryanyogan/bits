---
title: "Lesson 3"
order: 3
minutes: 5
xp: 60
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

Its one prompt exercise is coached and ungated (`coach gate=false`,
decision 064): tests run it end to end, from the run to the coach's
verdict to the save, with the judge stubbed.

:::prompt{id="on-call" xp=20 coach gate=false}
Put the rota in the prompt, then ask who's on call on Tuesday
- goal "Get Claude to tell you who's on call on Tuesday, using only the rota you give it"
- draft "Who's on call on Tuesday?"
- check "The rota is in the prompt" /tuesday|\btue\b/i
- check "The rota is in the prompt" /\bpriya\b/i
- expect "Names one person" match /\b(priya|sam|jo)\b/i
- expect "Short" sentences<=2
- rubric "Answers for Tuesday, from the rota" must evidence
- rubric "Says the answer comes from the rota" should
- hint "Claude can't see your rota unless it's in the message. Where is it now?"
- hint "Paste the rota first, then ask your question on the last line."
- reference "Here is our on-call rota:\nMon: Jo\nTue: Priya\nWed: Sam\n\nUsing only this rota, who is on call on Tuesday? Answer in one sentence."
- run temperature=[1.0]
- example T=1.0 "Priya is on call on Tuesday, according to the rota."
- success "Claude answered from the rota you gave it."
:::
