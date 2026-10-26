---
# sources (checked 2026-10-26):
# - Anthropic, Glossary ("Pretraining": autoregressive next-word prediction; "Temperature":
#   randomness in token selection)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - 3Blue1Brown, Transformers, the tech behind LLMs (final chapter: the last layer scores every
#   vocabulary token and softmax turns the scores into a probability distribution)
#   https://www.youtube.com/watch?v=wjZofJX0v4M
# - Anthropic, Reduce hallucinations (a model can state wrong things fluently and with confidence)
#   https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
illustrative: true
title: "Probabilities, not answers"
order: 4
minutes: 7
xp: 40
module: Picking the next word
---

When a model reaches the end of your prompt, it doesn't produce “the
answer”. It produces a **score for every token in its vocabulary**, all of
them, tens of thousands, then turns those scores into percentages that add up
to 100.

That list is the model's real output. The reply you read is what you get
when you **draw from that list**, add the token to the text, and repeat.
Step through one draw at a time:

:::nexttoken{prompt="The capital of Australia is"}
" Canberra" 0.86 | " Sydney":0.09 " a":0.02
"." 0.71 | ",":0.18 " and":0.05
:::

Two things to read off the odds.

**Most of the time one token dominates.** “Canberra” at 86% will win almost
every time, so the answer looks fixed. It isn't fixed. It's just very likely.

**The runner-up is often a classic mistake.** “Sydney” is there because lots
of text pairs Australia with Sydney. The model learned that from its training
text, and on a rare draw it can come out.

---

Here's the part people get wrong. A high probability means **“this is what
text like this usually says next”**, not “this is true”. If the training
text was confidently wrong about something, the model can be confidently
wrong too. Fluent and sure-sounding isn't the same as correct.

:::quiz{id="what-odds-mean" xp=20}
The model gives “ Canberra” an 86% chance. What does the 86% describe?

- [ ] How sure the model is that Canberra is the capital
  Not quite. It isn't checking facts. It's predicting text.
- [x] How likely that token is to come next in text like this
  Right. It's a prediction about text. It's often right about facts, but that's a side effect of good prediction.
- [ ] The share of its training data that mentions Canberra
  Not quite. The odds come from everything the model learned, not a count of one word.
:::

Your turn. Ask Claude to **name one animal, in one word**, then run it a few
times. You're sampling the same list of odds again and again. Which
answers keep coming back?

:::prompt{id="one-animal" xp=20}
Ask Claude for one animal, in one word

- placeholder "Name one animal. Reply with one word."
- draft "Name an animal."
- check "Asks for an animal"  /animal/i
- check "Asks for one word"   /one word|single word|1 word|one-word|just one/i
- run temperature=[1.0]
- example T=1.0 "Elephant"
- example T=1.0 "Fox"
- example T=1.0 "Elephant"
- example T=1.0 "Octopus"
- example T=1.0 "Elephant"
- success "Same odds, several draws. The favourite shows up most." next="Next: greedy vs. sampled →"
:::

:::rabbithole
- video "Transformers, the tech behind LLMs" by="3Blue1Brown" mins=27 url="https://www.youtube.com/watch?v=wjZofJX0v4M"
- read "Next-token prediction" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/ai-coding-dictionary/next-token-prediction"
:::
