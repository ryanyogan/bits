---
# sources (checked 2026-10-29):
# - Anthropic, Context windows ("working memory"; everything in the request counts: the system
#   prompt, every message, tool results, documents, tool definitions, then the output and its
#   thinking; 1M tokens for Claude Haiku 5.5, with prompts over 100k tokens priced higher;
#   usage reported on every response)
#   https://platform.claude.com/docs/en/build-with-claude/context-windows
# - Anthropic, System prompts (instructions set before the conversation: role, rules, format)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts
# - Anthropic, Glossary ("Context window": the model's working memory, separate from training)
#   https://platform.claude.com/docs/en/about-claude/glossary
# - Anthropic, Messages API (stateless: `system` plus the alternating `user`/`assistant`
#   `messages` are sent on every request; the model writes the next assistant turn)
#   https://platform.claude.com/docs/en/api/messages
# - Anthropic, Models overview (1M tokens is roughly 555k words; prompt cache reads cost
#   10% of the base input price on Claude Haiku 5.5)
#   https://platform.claude.com/docs/en/models/overview
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

:::new
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
:::

:::engineer
The model is a pure function of its input. It has no state between calls, no
access to your screen, your files or your last request. Each call delivers
one token sequence; the model continues it. Everything it “knows” about the
situation is in that sequence or in the weights, and the weights stopped
changing at the training cutoff.

---

The Messages API is stateless by design. A chat app keeps the transcript and,
on every send, posts the whole thing: an optional `system` string, then the
`messages` array of alternating `user` and `assistant` turns. The model
returns the next `assistant` turn. Turn two is turn one re-sent with two more
messages on the end; the model reads it as one document.

Below is the second turn of a chat as the user sees it and as the request
body reads. The system prompt is illustrative; real ones run to pages.
:::

:::compare{left="What you typed" right="What Claude gets" illustrative}
- prompt "Turn 2 of a chat"
- left "What's my name?"
- right "You are a friendly assistant. Keep answers short.\n\nUser: Hi, I'm Sam.\nAssistant: Hi Sam! What can I do for you?\nUser: What's my name?\nAssistant:"
:::

Three things to notice in the right column.

:::new
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
:::

:::engineer
**The system prompt.** The `system` field is where you set role, rules and
output format. Post-training (lesson 5) saw that slot filled in its
examples, so the model weights it above a user turn, which is the whole
reason to use it rather than pasting instructions into `messages`.

**The history is literal.** The only reason the model can answer “Sam” is
that turn 1 is in the array. Drop it and the model cannot know; nothing is
cached on the model's side.

**The budget is the context window.** For Claude Haiku 5.5 it is 1M tokens
(about 555k words), and everything in the request counts: `system`, every
message, tool results, documents, tool definitions, plus the output and any
thinking. Every response reports `usage`. Two cost notes: on Haiku 5.5,
prompts over 100k tokens are priced higher, and prompt cache reads cost 10%
of the input price, so a long stable prefix (system prompt, documents) should
be cached rather than re-paid.

---

Everything a product calls memory, tools, search or “reading a file” is one
mechanism: code outside the model puts text into the window before the call.
Long chats “forget” because the app truncated or summarised the transcript.
Cross-session memory is saved notes re-inserted into `system` or the first
turn. A PDF is extracted text, or an image block, in a message. Once you see
that, context engineering is the whole job: decide what goes in the window,
in what order, at what cost.
:::

Here's the limit in miniature: a window of twelve tokens and a chat arriving
one turn at a time. Watch what has to go once it's full.

:::flow{capacity=12 title="A window of 12 tokens, one turn at a time" illustrative}
- "system prompt" 3
- "Hi, I'm Sam." 2
- "Hi Sam! What can I do for you?" 3
- "What's my name?" 2
- "Sam." 1
- "Tell me a joke about rain." 3
- "Why did the cloud stay in? It felt under the weather." 4
:::

Real windows hold a million tokens, and real apps don't drop the system
prompt: they trim or summarise the middle turns instead. The shape is the
same. Once the window is full, something has to go, and whatever went, the
model never saw it.

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
