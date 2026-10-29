---
# sources (checked 2026-10-29):
# - Anthropic, Context windows ("working memory"; everything in the request counts: system
#   prompt, every message so far, documents, then the reply; 1M tokens for Claude Haiku 5.5)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic, System prompts (instructions set before the conversation: role, rules, format)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts
# - Anthropic, Glossary ("Context window": the model's working memory, separate from training)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Messages API (stateless: the whole conversation is sent on every request)
#   https://platform.claude.com/docs/en/api/messages
# - Matt Pocock (AI Hero), Messages, System Prompts and Reasoning Tokens (the chat protocol:
#   user and assistant turns, a hidden system prompt the model gives priority to)
#   https://www.aihero.dev/messages-system-prompts-and-reasoning-tokens
# - bits app/runs/model.ts: each sandbox run sends one user message, no history, no tools.
# Toy: the system prompt text is illustrative.
title: "Your prompt is all it sees"
order: 6
minutes: 6
xp: 40
module: How it got this way
---

Lesson 1 said each run sends only what's in the box. Here's the bigger idea
behind that, and it's the one that explains most of what apps like claude.ai
do.

A model has no eyes on your screen and no memory of yesterday. Each time it
writes, it gets **one piece of text** and continues it. That's the whole
interface. Everything the model “knows about you” has to be inside that
text.

---

So how does a chat work? Each time you press send, the app takes **every turn
so far**, yours and the model's, glues them into one long text and sends
the lot. The model reads it as a single document and writes the next turn.
Your second message isn't a second conversation. It's the first one, re-sent,
with more on the end.

Here's the second turn of a short chat, as you see it and as Claude sees it.
The hidden note at the top is illustrative; real ones are longer.

:::compare{left="What you typed" right="What Claude gets" illustrative}
- prompt "Turn 2 of a chat"
- left "What's my name?"
- right "You are a friendly assistant. Keep answers short.\n\nUser: Hi, I'm Sam.\nAssistant: Hi Sam! What can I do for you?\nUser: What's my name?\nAssistant:"
:::

Three things to notice in the right column.

**There's a note up top you never wrote.** That's the **system prompt**:
instructions the app puts first, saying who the model should be and how to
answer. You've been living inside one on every chat app you've used. Lesson
5's example conversations had the same shape, which is why the model treats
that note as the boss.

**The old turns are there in full.** That's the only reason Claude can answer
“Sam”. Delete turn 1 from the text and it honestly can't know.

**There's a size limit.** The text the model can read at once is its **context
window**. For Claude Haiku 5.5 it's a million tokens (as of October 2026),
which is several novels, so running out is rare in a chat. It's working
memory, not long-term memory. The **Context is everything** course is about
what to put in it.

---

This settles a few mysteries at once. Why does a long chat “forget” its
start? Because the app stopped sending it. How does an app “remember” you
across days? It saved notes and pastes them into the text. How does Claude
“read” a PDF or a web page? The app turns it into text and puts it in the
window. Tools, search, documents, memory: text in the window, every time.

The flip side is the most useful habit in this course. If Claude needs a
fact, **put it in the prompt**. Try it: tell Claude something it can't know,
then ask it to use that fact in the same message.

:::prompt{id="put-it-in-the-prompt" xp=40}
Tell Claude a fact about you, then ask it to use that fact

- placeholder "My … is …. Now …?"
- draft "My dog is called Biscuit and he hates rain. Suggest a name for his raincoat."
- check "Gives Claude a fact"        /\bmy (name|dog|cat|team|city|town|job|boss|sister|brother|kid|favourite|favorite)\b|\bi (am|live|work|have|like|love|run)\b|\bi.m\b/i
- check "Asks it to use the fact"    /\?|suggest|write|tell me|what|which|remind|repeat|use/i
- run temperature=[1.0]
- example T=1.0 "For a rain-hating dog called Biscuit, how about “The Crumb Cover”? Dry biscuits are the whole point."
- example T=1.0 "Call it the Biscuit Tin: the one place Biscuit stays dry."
- example T=1.0 "“Soggy-Proof” has a ring to it, though Biscuit may still refuse to go out."
- success "It used your fact because your fact was in the text. Now send the same question without it, and see what it does." next="Next: attention, how it keeps track →"
:::

Now run the second half without the fact (just “suggest a name for his
raincoat”). Claude will ask whose raincoat, or guess. Nothing from your last
run reached it. That's not forgetfulness; it's the interface.

:::rabbithole
- read "Context windows" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/context-windows"
- read "Messages, system prompts and reasoning tokens" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/messages-system-prompts-and-reasoning-tokens"
:::
