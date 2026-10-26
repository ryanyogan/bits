---
# sources (checked 2026-10-26):
# - Anthropic, Models overview (Claude Haiku 5.5: fastest current model; id claude-haiku-5-5)
#   https://platform.claude.com/docs/en/models/overview
# - Anthropic, Glossary ("LLM", "Pretraining", "Fine-tuning")
#   https://platform.claude.com/docs/en/about-claude/glossary
# - bits decision 019 (sandbox: only T=1.0 runs live, examples otherwise, hourly limits)
#   docs/decisions/019-live-prompts.md
# Lessons can't hold raw HTML, so sources live in this YAML comment, not <!-- -->.
title: "Say hi to Claude"
order: 1
minutes: 5
xp: 30
module: Meet the model
---

Welcome to bits. No sign-up, no setup and no maths. Let's start by talking to
one.

The box below sends your words to **Claude**, an AI model made by Anthropic.
Ask it what it is. The draft is nearly there: add “in one sentence”, then hit
Run.

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

You just talked to a **large language model**, an LLM. “Large” because it's
built from a huge number of internal settings and trained on a huge amount of
text. “Language model” because its job is predicting text.

---

A few honest notes about this sandbox, so nothing surprises you later.

**It's real and it's free.** Runs here go live to **Claude Haiku 5.5**,
Anthropic's fastest current model (as of October 2026). Answers are kept
short on purpose.

**Every run starts fresh.** The sandbox sends only the prompt in the box. It
doesn't send your earlier runs, so Claude can't see them.

**Only temperature 1.0 runs live.** That's how Claude really samples. When a
lesson offers another setting, you'll see a saved example, labelled as an
example.

**Runs are rationed.** There's an hourly limit (higher if you sign in). Past
it, you get a labelled example output instead of a live one, and you can keep
going.

---

Here's a peek at what happened while it answered. Each step shows the word it
picked and a few it didn't. These numbers are made up to show the idea; the
next lesson explains them.

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
