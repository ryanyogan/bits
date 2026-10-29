---
# sources (checked 2026-10-29):
# - Anthropic, Prompting best practices ("Be clear and direct" and the new-colleague test,
#   "Add context to improve performance", "Use examples effectively")
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Reduce hallucinations ("Allow Claude to say I don't know")
#   https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
# - Anthropic, Prompt engineering overview
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
# Toy: both outputs are illustrative.
title: "Checkpoint: talk to it well"
order: 9
minutes: 8
xp: 60
module: Using it well
project: true
---

You know what's on the other end now: a next-token guesser, trained on a
mountain of text, shaped into an assistant, and blind to anything you don't
tell it. That last part is the key to prompting.

Claude only has your words to go on. So a good prompt is mostly **the context
you'd give a smart new colleague** on their first day. Here's one request,
sent bare and then with that context added.

:::compare{left="Bare request" right="With who, why and length" illustrative}
- prompt "Write a welcome message for my running club."
- left "Welcome to the club! We're thrilled to have you join our community of passionate runners. Whether you're a seasoned marathoner or lacing up for the first time, you'll find support, motivation and friendship here. Together, we'll push our limits and celebrate every milestone…"
- right "Welcome! Nobody gets left behind here. Our Saturday slow group runs at chatting pace, walk breaks included, so come as you are. See you Saturday!"
:::

The right column came from adding one line: it's for **nervous beginners**,
keep it **friendly** and **under 40 words**, and mention the Saturday slow
group. Same model. Very different answer.

---

Six habits that do most of the work:

**Put the facts in the prompt.** Lesson 6's rule. If Claude needs a name, a
date, a document or a decision you've already made, it's not there unless
you type it.

**Say exactly what you want.** Anthropic's test: would a colleague with no
background understand your prompt? If not, neither will Claude.

**Say who it's for and why.** The reason behind a request helps Claude make
the calls you'd make.

**Give it a shape.** A length, a format, a number of options.

**Show an example** when style matters. Claude copies examples closely, so
pick good ones.

**Let it say “I don't know”, or ask you questions.** Then read the answer,
tweak the prompt and run it again. Prompting is a loop, not a spell.

---

Checkpoint time. Write a prompt for something you actually need: an email, a
plan, an explanation. Hit all four checks, then run it.

:::prompt{id="talk-to-it-well" xp=60}
Write a prompt for a real task, with who it's for, why, a shape and room to ask

- placeholder "Write … for … because … Keep it under … If anything's unclear, ask me first."
- draft "Write a welcome message for my running club."
- check "Says who it's for"             /\bfor (a|an|my|our|the|new|people)\b|\bto (my|our)\b|audience|reader|beginner/i
- check "Gives a reason or context"     /because|so that|\bgoal\b|\bcontext\b|I.m |\bI am\b|we.re|\bwe are\b/i
- check "Sets a length or format"       /\bwords?\b|sentences?|bullet|\blist\b|paragraph|\bshort\b|\bunder\b|table|steps/i
- check "Invites questions or doubt"    /not sure|don.t know|unsure|ask me|questions|clarif/i
- run temperature=[1.0]
- example T=1.0 "Welcome! Nobody gets left behind here. Our Saturday slow group runs at chatting pace, walk breaks included, so come as you are. See you Saturday!"
- example T=1.0 "New to running? Perfect. Our Saturday slow group is built for beginners: easy pace, walk breaks welcome, no one left behind. We'd love to see you there."
- example T=1.0 "Quick question first: do you want the Saturday start time and meeting spot included? Here's a draft without them: Welcome! Saturdays are slow and friendly, and everyone finishes together."
- success "That's the course. You can talk to an LLM and you know what's going on inside it." next="Next: Tokens & temperature →"
:::

Finish this checkpoint and the course badge is yours. Two good next steps: **Tokens & temperature** goes
deeper into tokens, odds and randomness, and **Prompting that works** turns
these six habits into a toolkit.

:::rabbithole
- read "Prompting best practices" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- video "AI prompt engineering: A deep dive" by="Anthropic" mins=77 deep url="https://www.youtube.com/watch?v=T9aRN5JkmL8"
:::
