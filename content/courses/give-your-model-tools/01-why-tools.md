---
# sources (checked 2026-10-27):
# - Anthropic, Tool use with Claude (tool use = function calling; Claude decides when to call
#   from the request and the tool's description; client tools run in your app, server tools
#   such as web_search and code_execution run on Anthropic's infrastructure)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Anthropic, Models overview (Claude Haiku 5.5 reliable knowledge cutoff: Jun 2026)
#   https://platform.claude.com/docs/en/about-claude/models/overview
# - bits app/runs/model.ts (the sandbox sends one user message, no tools)
# Compare toy: both replies are illustrative.
title: "Why models need tools"
order: 1
minutes: 6
xp: 40
module: Why tools
---

On its own, Claude is a very good text predictor. That gets you a long way,
but there are three things it can't do by predicting text, however good the
prompt is.

**It can't fetch.** It knows what was in its training text, up to a cutoff
date. It doesn't know today's weather, your order history, or what's in your
database.

**It can't compute reliably.** It does sums the way it does everything else:
by predicting what comes next. That's usually right for small numbers and
easy to get wrong for big ones.

**It can't act.** Writing “I've sent the email” is just more text. Nothing
leaves the building.

---

**Tools** close all three gaps. You describe a function to Claude: its name,
what it's for, and what inputs it takes. When a question needs it, Claude
doesn't guess. It replies with a **request to call the function**, with the
arguments filled in. Your code runs it and hands back the result, and Claude
writes the answer from real data.

Anthropic calls this **tool use**. Other providers call it **function
calling**. It's the same idea.

:::compare{left="Claude, no tools" right="Claude with a get_weather tool" illustrative}
- prompt "Do I need a coat in Chicago right now?"
- left "I can't check live weather, so I don't know what it's like in Chicago right now. In late October it's often cool, so a light coat is a safe bet. A weather app will tell you for sure."
- right "Yes. It's 41°F and overcast in Chicago right now, so bring a coat."
:::

The left answer is honest and not very useful. The right one is only
possible because a tool looked up the weather. Claude never touched the
weather service: it asked, your code fetched, and Claude read the result.

That split is the whole idea. **The model decides; your code does.** Claude
picks the tool and the arguments, and your code stays in charge of what
actually runs.

:::quiz{id="needs-a-tool" xp=20}
Which of these questions really needs a tool?

- [ ] “Explain what JSON is, in two sentences.”
  Not quite. That's stable knowledge Claude learned in training. No lookup needed.
- [x] “Has order #4821 shipped yet?”
  Right. That lives in your database, and it changes. Claude can't know it without a lookup.
- [ ] “Write a haiku about the sea.”
  Not quite. Creative writing is what the model does best on its own.
:::

---

One more distinction before we build. **Client tools** run in your code:
you write the function and you run it when Claude asks. **Server tools** run
on Anthropic's side, like web search and code execution: you switch them on
and Claude uses them without your code doing the work. Most of this course is
about client tools, because they're how you connect Claude to **your**
systems. Server tools get their own lesson near the end.

Your turn. The sandbox on this page runs Claude with **no tools at all**.
Ask it for something only a tool could know, like the weather somewhere
right now, and tell it to say so if it can't check.

:::prompt{id="cant-check" xp=20}
Ask Claude for live information, and let it say it can't check

- placeholder "What's the weather in … right now? If you can't check, say so."
- draft "What's the weather in Lisbon right now?"
- check "Asks for something live"     /right now|today|current|currently|latest|this (morning|afternoon|evening|week)/i
- check "Lets it say it can't check"  /can.t|cannot|unable|not able|don.t know|say so|admit|if you (can|are)/i
- run temperature=[1.0]
- example T=1.0 "I can't check live weather, so I don't know what Lisbon is like right now. A weather app or website will have the current conditions."
- example T=1.0 "I don't have access to real-time data, so I can't tell you Lisbon's weather right now. Late October there is usually mild, around 15–20°C, but check a forecast to be sure."
- example T=1.0 "I'm not able to look that up: I have no internet access or live data here. Try a weather service for Lisbon's current conditions."
- success "That's the gap a tool fills. Next, you'll describe one." next="Next: describing a tool →"
:::

:::rabbithole
- read "Tool use with Claude" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview"
- read "How tool use works" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works"
:::
