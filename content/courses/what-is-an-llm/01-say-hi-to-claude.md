---
# sources (checked 2026-10-29):
# - Anthropic, Models overview (Claude Haiku 5.5: comparative latency "Fastest"; API id
#   claude-haiku-5-5; 1M-token context window; 128K max output; from $0.10 / input MTok and
#   $0.50 / output MTok; Claude models take text and images)
#   https://platform.claude.com/docs/en/models/overview
# - Anthropic, Glossary ("LLM", "Pretraining", "Fine-tuning")
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Messages API (one request = the messages so far, the model writes the next one)
#   https://platform.claude.com/docs/en/api/messages
# - bits decision 019 (sandbox: one fresh request per run, hourly limits, labelled examples past them)
#   docs/decisions/019-live-prompts.md
# Lessons can't hold raw HTML, so sources live in this YAML comment, not <!-- -->.
title: "Say hi to Claude"
order: 1
minutes: 5
xp: 30
module: Meet the model
---

:::new
Welcome to bits. No sign-up, no setup and no maths. Let's start by talking to
one.

The box below sends your words to **Claude**, an AI model made by Anthropic.
Ask it what it is. The draft is nearly there: add “in one sentence”, then hit
Run.
:::

:::engineer
Welcome to bits. This course is the mental model under every other one here:
what a language model is, how it writes, what it sees, where it breaks. Each
lesson is one idea with a live run.

The box below is a thin wrapper over one Messages API request to Claude. No
system prompt of yours, no history, no tools. Add “in one sentence” to the
draft and run it.
:::

:::prompt{id="say-hi" xp=30}
Ask Claude what it is, in one sentence

- placeholder "Hi Claude! …"
- draft "Hi Claude! What are you, exactly?"
- check "Talks to Claude"        /\byou\b|claude/i
- check "Asks what it is"        /what|who|explain|describe|tell me/i
- check "Asks for one sentence"  /one sentence|1 sentence|single sentence|one line|\bbrief/i
- run temperature=[1.0]
- example T=1.0 "I'm Claude, an AI model made by Anthropic: I read your text and write a reply, one small piece at a time."
- example T=1.0 "I'm Claude, an AI assistant built by Anthropic that turns your words into a written answer by predicting what comes next."
- example T=1.0 "I'm Claude, a large language model from Anthropic, trained on lots of text to understand questions and write helpful replies."
- success "You just talked to a large language model. The rest of this course shows what happened in between." next="Next: a very good next-word guesser →"
:::

:::new
You just talked to a **large language model**, an LLM. “Large” because it's
built from a huge number of internal settings and trained on a huge amount of
text. “Language model” because its job is predicting text.

---

Three words you'll hear everywhere, sorted out once. **AI** is the umbrella
word: software doing things we used to think needed a person. An **LLM** is
the kind of AI that reads and writes text. **Claude** is one LLM. The chat
apps you may have used, like claude.ai or ChatGPT, are a window wrapped around
a model like this one. Here you talk to the model with almost nothing in
between.

Claude can look at images too. This course sticks to text, because text is
where everything else starts.

---

One honest note about this sandbox. Runs go live to **Claude Haiku 5.5**,
Anthropic's fastest current model (as of October 2026), for free, with an
hourly limit that's higher if you sign in. Past the limit you get a saved
example, labelled as one, and you can keep going. Answers are kept short on
purpose. And each run sends only what's in the box, nothing from before. Why
that matters is lesson 6.
:::

:::engineer
What answered you is a **large language model**: a function from text to a
probability distribution over the next token, applied in a loop until it
emits a stop. “Large” is the parameter count and the training corpus.
Everything else (chat, tools, memory, agents) is built on top of that loop,
by code outside the model. Lesson 2 is the loop, lesson 6 is what the loop
gets to read.

---

Terms, pinned. **AI** is the umbrella. An **LLM** is the text-in, text-out
kind. **Claude** is Anthropic's family of LLMs; a product like claude.ai is
an app around one, with its own system prompt, history and tools. The
sandbox here skips all of that: one `user` message in, one `assistant` message
out.

Claude models take text and images as input. This course is text only.

---

The sandbox, precisely. Runs go to `claude-haiku-5-5`, the “Fastest” latency
tier in Anthropic's lineup (October 2026), listed from $0.10 per million input
tokens and $0.50 per million output tokens, with a 1M-token context window.
Each run is one fresh request with a short `max_tokens`, no thinking and no
history, so a second run knows nothing about the first. Past the hourly
limit (higher when signed in) you get a saved example, labelled as one.
:::

---

Here's a peek at what happened while it answered: the word it picked at each
step, and a few it didn't. The numbers are illustrative; the next lesson
explains them.

:::nexttoken{prompt="Hi Claude! In one sentence, what are you?" illustrative}
"I'm" 0.88 | "Hi":0.07 "Hello":0.03
" Claude" 0.95 | " an":0.03 " a":0.01
"," 0.83 | " —":0.09 ":":0.05
" an" 0.71 | " a":0.24 " Anthropic's":0.03
" AI" 0.92 | " assistant":0.04 " artificial":0.02
" model" 0.48 | " assistant":0.46 " system":0.04
:::

:::rabbithole
- video "Large Language Models explained briefly" by="3Blue1Brown" mins=8 url="https://www.youtube.com/watch?v=LPZh9BOjkQs"
- video "How I use LLMs" by="Andrej Karpathy" mins=131 deep url="https://www.youtube.com/watch?v=EWvNQjAaOHw"
:::
