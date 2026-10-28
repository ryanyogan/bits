---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices > Long context prompting (documents first, query last;
#   <document>/<source>/<document_content> tags; quote first)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting
# - Anthropic, Reduce hallucinations (let Claude say it doesn't know; ground answers in quotes)
#   https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
# - Anthropic, Prompt caching (stable content first so it can be cached; what changes goes last)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-caching
# - Anthropic Engineering, Effective context engineering for AI agents (smallest set of
#   high-signal tokens)
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# Toy: both replies are illustrative.
title: "Checkpoint: pack the window"
order: 7
minutes: 8
xp: 60
module: Putting it together
project: true
---

Time to use the whole course on one prompt. You're building the help desk
for **Moon Café** again, and this time it answers from the café's own info
sheet instead of whatever it half-remembers.

A well-packed prompt for this has a clear shape. **Stable parts first**: who
Claude is and how to answer, then the info sheet in a `<document>` with a
`<source>`. In a real app this whole block is what you'd cache, because it's
identical on every request. **What changes goes last**: the customer's
question. In between, two habits that keep answers honest: **quote first**,
and **say so when the sheet doesn't cover it**. And nothing else: no
backstory, no old menus.

:::compare{left="Question and a raw paste" right="Packed prompt" illustrative}
- prompt "Do you have Wi-Fi? (The info sheet lists hours, milk options and the dog policy. It doesn't mention Wi-Fi.)"
- left "Yes! Moon Café offers free high-speed Wi-Fi for all customers. Just ask a barista for the password."
- right "<quotes>No quote: the info sheet doesn't mention Wi-Fi.</quotes> I can't see Wi-Fi on our info sheet, so I'm not sure. A barista can tell you in person."
:::

The left reply sounds helpful and is invented. The right one admits the gap
because the prompt gave it permission to.

---

Checkpoint. Use this info sheet: **Moon Café, open Mon–Fri 7am–6pm, Sat
8am–4pm, closed Sunday. Oat milk is free. Dogs welcome on the terrace.**
Write the whole prompt: Claude's job, the sheet wrapped in tags with a
source, a request to quote first, permission to say the sheet doesn't cover
something, a length limit, and a customer question at the end. Then try a
question the sheet can't answer.

:::prompt{id="pack-the-window" xp=60}
Pack the window: job, tagged document, quote first, honest gaps, short answer, question last

- placeholder "You answer questions for Moon Café… <document><source>…</source><document_content>…</document_content></document> Quote … If … Under … words. Customer: …?"
- draft "Are you open on Sunday? Moon Café, open Mon–Fri 7am–6pm, Sat 8am–4pm, closed Sunday. Oat milk is free. Dogs welcome on the terrace."
- check "Gives Claude its job"             /you are|you're|your job|you answer|answer (customer|questions)|assistant/i
- check "Wraps the sheet in tags"          /<document/i
- check "Names the source"                 /<source>/i
- check "Asks for a quote first"           /quot/i
- check "Allows “it doesn't say”"          /not (in|on|covered|mentioned|listed)|doesn.t (say|cover|mention)|don.t know|not sure|can.t find|isn.t (there|covered|listed)/i
- check "Sets a length limit"              /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b/i
- check "Ends with a customer question"    /\?/
- run temperature=[1.0]
- example T=1.0 "<quotes>“closed Sunday”</quotes> Sorry, we're closed on Sundays. On Saturday we're open 8am–4pm."
- example T=1.0 "Quote: “Sat 8am–4pm, closed Sunday.” No, Moon Café is closed on Sunday. Come by Saturday until 4pm!"
- example T=1.0 "<quotes>“closed Sunday”</quotes> We're closed Sundays, but open Monday from 7am."
- success "Docs in tags, question last, quotes first, honest about gaps. That's a packed window." next="Finish the course →"
:::

Finish this checkpoint and the **Context is everything** badge is yours. You
can now say what fills a context window, why less is often more, how to lay
out long documents and long chats, and how to make a stable prefix cheap.
Next, **Give your model tools** lets Claude fetch context for itself, and
**Retrieval without tears** picks the right pieces from a big pile.

:::rabbithole
- read "Long context prompting" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting"
- read "Reduce hallucinations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations"
- video "[1hr Talk] Intro to Large Language Models" by="Andrej Karpathy" mins=60 deep url="https://www.youtube.com/watch?v=zjkBMFhNj_g"
:::
