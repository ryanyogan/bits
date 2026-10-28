---
# sources (checked 2026-10-27):
# - Anthropic, Context windows ("working memory", not the training data; everything in the
#   request counts: system prompt, messages incl. tool results, images and documents, tool
#   definitions, plus the output and its thinking; 1M tokens for Fable 5.1, Opus 5.5,
#   Sonnet 5.5, Haiku 5.5 and others; up to 128k output per request; older models such as
#   Sonnet 4.5 have 200k)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic, Messages API / claude-api skill ("The API is stateless - send the full
#   conversation history each time")
# - Andrej Karpathy, Deep Dive into LLMs like ChatGPT (knowledge in the parameters is a vague
#   recollection; what's in the context window is working memory the model can use directly)
#   https://www.youtube.com/watch?v=7xTGNNLPyMI
# - bits app/runs/model.ts: every sandbox run is a single fresh request.
title: "What's in the window"
order: 1
minutes: 6
xp: 50
module: The window
---

A model knows two kinds of things. What it soaked up in training is baked into
its weights: broad, fuzzy, and frozen at a cutoff date. What you put in front
of it **right now** is the **context window**: the text it can actually read
while it writes. Andrej Karpathy's way of putting it is that the weights are a
vague recollection and the context is working memory.

Working memory is the part you control. Anthropic counts **everything in the
request** toward it: the system prompt, every earlier message in the chat
(including tool results, images and documents), the definitions of any tools
you hand it, and then the reply Claude writes, thinking included.

---

How big is it? As of October 2026, every current Claude model (Fable 5.1,
Opus 5.5, Sonnet 5.5 and Haiku 5.5, the model in this sandbox) has a
**1M-token** window, and one reply can be up to 128k tokens of it. Some older
models stop at 200k. A million tokens is several long novels, so on paper you
can fit a lot.

Two things it is **not**. It isn't memory between requests: the API is
stateless, so a chat app re-sends the whole conversation every turn, and
anything you don't send, Claude has never seen. And it isn't the training
data: pasting a document in doesn't teach the model anything for next time.

:::quiz{id="what-counts" xp=20 multiple}
Which of these count toward Claude's context window on a request? Pick all that apply.

- [x] The system prompt
  Yes. Instructions are tokens like any other.
- [x] Earlier messages in the conversation
  Yes. The whole history is re-sent each turn, and all of it counts.
- [x] Definitions of the tools you pass in
  Yes. Tool names, descriptions and schemas are part of the request.
- [x] The reply Claude is writing, including its thinking
  Yes. Output shares the same window as the input.
- [ ] The books and web pages Claude was trained on
  No. That's baked into the weights, not sent with your request.
:::

---

You can see the statelessness right here. Every run in this sandbox is a
fresh request with nothing carried over. Ask Claude who's on call this
weekend and it can only guess. Then give it the rota, **Saturday: Priya,
Sunday: Marco**, in the same prompt, and ask again.

:::prompt{id="on-call" xp=30}
Put the rota in the prompt, then ask who's on call

- placeholder "Rota: … Who's on call …?"
- draft "Who's on call this weekend?"
- check "Includes the rota"     /priya/i
- check "Includes the rota"     /marco/i
- check "Asks a question"       /\?/
- run temperature=[1.0]
- example T=1.0 "Priya is on call on Saturday, and Marco takes Sunday."
- example T=1.0 "Saturday: Priya. Sunday: Marco."
- example T=1.0 "Priya has Saturday and Marco has Sunday, per the rota."
- success "If it isn't in the window, Claude doesn't know it." next="Next: bigger isn't better →"
:::

:::rabbithole
- read "Context windows" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/context-windows"
- video "Deep Dive into LLMs like ChatGPT" by="Andrej Karpathy" mins=211 deep url="https://www.youtube.com/watch?v=7xTGNNLPyMI"
- read "Context window" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/ai-coding-dictionary/context-window"
:::
