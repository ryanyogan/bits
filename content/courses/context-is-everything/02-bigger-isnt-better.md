---
# sources (checked 2026-10-27):
# - Anthropic, Context windows (more context isn't automatically better: as token count grows,
#   accuracy and recall degrade, "context rot"; input over the window is a 400 "prompt is too
#   long"; generation that reaches the window stops with stop_reason
#   "model_context_window_exceeded"; compaction and context editing as the fixes)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic Engineering, Effective context engineering for AI agents (2025-09-29): context
#   rot shows up on every model; an "attention budget" that every token draws on; n² pairwise
#   relationships; a gradient, not a cliff; "smallest possible set of high-signal tokens")
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - Anthropic, Pricing (Claude Haiku 5.5: $0.10 / MTok input up to 100K-token prompts,
#   $0.50 above)
#   https://platform.claude.com/docs/en/about-claude/pricing
# Toy: weights are illustrative, one made-up head.
title: "Bigger isn't better"
order: 2
minutes: 6
xp: 40
module: The window
---

A million tokens sounds like you can stop choosing. Paste the whole wiki, the
whole codebase, the whole chat, and let the model sort it out. Anthropic's own
docs warn against exactly this: **as the token count grows, accuracy and
recall degrade**. They call it **context rot**, and their engineers say it shows
up across all models, not just weak ones.

---

Why would more text make a model worse? Recall attention from **What is an
LLM, really?**: at each step, a token looks back and decides how much weight
to give every earlier token. Anthropic describes this as an **attention
budget**. Every token you add draws on it, and with n tokens there are n²
pairs to weigh. The detail you care about has to compete with everything
else you sent.

Here's a toy version. It starts on the final “?”: see where that token's
attention goes. The weights are illustrative, made up to show the idea.

:::attention{caption="Where does the question look?" illustrative}
tokens "The" " code" " is" " 4471" "." " Lunch" " is" " at" " noon" "." " The" " lift" " is" " broken" "." " Parking" " is" " full" "." " What" " is" " the" " code" "?"
- from=23 to=3 w=0.34
- from=23 to=22 w=0.18
- from=23 to=1 w=0.10
- from=23 to=8 w=0.07
- from=23 to=13 w=0.06
- from=23 to=17 w=0.06
- from=23 to=11 w=0.05
- from=23 to=15 w=0.04
- from=22 to=1 w=0.30
- from=22 to=19 w=0.15
:::

The answer, “4471”, still gets the biggest share, but a lot of the weight
leaks onto lunch, lifts and parking. Three filler sentences are nothing. Now
picture three hundred pages of them. That's not a cliff where the model
suddenly fails: it's a slope. The model stays capable, but gets less precise
about finding and linking details as the context grows.

---

And at the actual limit? If your input alone is over the window, the API
refuses the request with a “prompt is too long” error. If the input fits but
the reply runs into the limit, Claude stops early with the stop reason
`model_context_window_exceeded`. The API never silently drops old messages
for you. Some chat apps do that behind the scenes; with the API, trimming is
your job (or a feature you switch on, which you'll meet in two lessons).

:::quiz{id="over-the-limit" xp=20}
You send Claude Sonnet 5.5 a request whose input is 1.2M tokens. What happens?

- [ ] Claude reads the last 1M tokens and ignores the start
  Not quite. The API doesn't trim for you.
- [x] The request fails with a “prompt is too long” error
  Right. Input over the window is rejected before the model runs.
- [ ] The API summarises the oldest part automatically
  Only if you turned on compaction. By default nothing is summarised.
:::

There's a money side too. On Claude Haiku 5.5, a prompt over 100,000 tokens
is billed at **$0.50 per million input tokens instead of $0.10** (October
2026 prices). Big context costs more per token as well as more tokens.

:::quiz{id="whole-manual" xp=20}
A 300-page product manual is about 150,000 tokens. A user asks how to reset one setting. It all fits in Haiku 5.5's window. What's the best move?

- [ ] Send the whole manual: it fits, so the model can find it
  Not quite. It fits, but recall gets less precise as context grows, and on Haiku 5.5 you'd pay the over-100K price.
- [x] Send the chapter about that setting, plus the question
  Right. A few thousand relevant tokens beat 150,000 mostly irrelevant ones, on accuracy and on cost.
- [ ] Send only the question, so the context stays clean
  Not quite. Now the facts aren't in the window at all, so Claude can only guess.
:::

:::rabbithole
- read "Effective context engineering for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
- read "Context windows" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/context-windows"
- video "Attention in transformers, step-by-step" by="3Blue1Brown" mins=26 url="https://www.youtube.com/watch?v=eMlx5fFNoYc"
:::
