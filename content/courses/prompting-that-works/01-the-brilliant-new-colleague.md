---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Be clear and direct" (Claude as a brilliant but new
#   employee; the colleague test; ask explicitly for more than the bare task; numbered steps
#   when order matters)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Prompting Claude Sonnet 5, "More literal instruction following" (doesn't infer
#   requests you didn't make; state the scope explicitly)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5
# - bits app/runs/model.ts (sandbox: Claude Haiku 5.5, one user message, replies under 80 words)
# Toy: both outputs are illustrative. "Trailhead" is a made-up bottle.
title: "The brilliant new colleague"
order: 1
minutes: 6
xp: 50
module: Say what you mean
---

You met five prompting habits at the end of the first course. This course
turns each one into a tool you can use on purpose, and you'll run every one
live on Claude.

Start with the habit under all the others. Anthropic's advice is to treat
Claude like a **brilliant colleague on their first day**. They're sharp and
fast, but they know nothing about your project, your users or what “good”
means to you. Anything you leave out, they have to guess.

---

Here's the test. Before you send a prompt, picture handing it to a smart
person who has never seen your work. Would they need to ask you questions? If
so, Claude will have to guess the answers, and guesses come out generic.

Same task, two prompts. The left one is **“Write a description of our water
bottle.”** The right one adds who reads it, the facts, where it goes and how
long it should be.

:::compare{left="Vague prompt" right="Colleague-ready prompt" illustrative}
- prompt "Task: a product blurb for the Trailhead steel bottle"
- left "Stay hydrated in style with our premium water bottle! Crafted from high-quality materials, it's the perfect companion for every adventure, whether you're at the gym, the office or on the go. Durable, sleek and eco-friendly, it's the last bottle you'll ever need…"
- right "Keeps water cold for 24 hours on the trail. The 750 ml Trailhead is double-walled steel with a leakproof lid, and at 340 g it won't weigh down your pack."
:::

The left reply isn't wrong. It's just the average of every bottle blurb ever
written, because that's all the prompt asked for. The right one could only be
about this bottle.

---

Two more things about how current Claude models read you.

**They take you at your word.** Recent models follow instructions closely,
and some very literally. Ask for a description and you get one description. If you also want
a headline, three options or a bolder tone, say so. Claude won't assume you
wanted extra.

**Order matters, so number it.** When the steps have to happen in a set order,
or none can be skipped, write them as numbered steps instead of one long
sentence.

:::quiz{id="colleague-test" xp=10}
Which prompt passes the colleague test best?

- [ ] “Write a great email to the team.”
  Not quite. “Great” is a feeling, not an instruction. A new colleague would ask: about what, and how long?
- [ ] “Write an email. Make it really good and professional, don't be boring.”
  Not quite. More adjectives, but still no facts. A colleague would still have to guess the topic.
- [x] “Write a 3-sentence email telling the team the Friday demo moves to Monday 10am because the client is travelling.”
  Right. It has the topic, the facts, the reason and the length. Nothing is left to guess.
:::

---

Your turn. The draft is the vague prompt. Rewrite it so a new colleague could
nail it first time: say **who reads it**, give **real facts** (make them up,
it's practice), say **where it will appear** and set a **length**.

:::prompt{id="colleague-ready" xp=40}
Rewrite the vague request so a brilliant new colleague could do it first time

- placeholder "Write a … for … It will appear on … Facts: … Keep it under …"
- draft "Write a description of our water bottle."
- check "Says who reads it"         /\bfor (a|an|my|our|the|people|hikers|runners|parents|kids|busy|new)\b|audience|readers?\b|customers?|buyers?|shoppers?/i
- check "Gives real facts"          /\d/
- check "Says where it will appear" /\bpage\b|website|\bsite\b|listing|\bshop\b|\bstore\b|email|\bads?\b|instagram|social|label|packaging|catalog/i
- check "Sets a length"             /\bwords?\b|sentences?|\bunder\b|\bshort\b|\blines?\b|paragraph|characters/i
- run temperature=[1.0]
- example T=1.0 "Cold for 24 hours, light enough to forget it's there. The 750 ml Trailhead is double-walled steel with a lid that won't leak in your pack."
- example T=1.0 "Built for long trails: 750 ml, double-walled steel, 24 hours cold, 340 g. The leakproof lid means it rides in your bag, not your hand."
- example T=1.0 "Trailhead keeps water ice-cold for a full day out. 750 ml of steel, leakproof, and just 340 g."
- success "Specific in, specific out. Every lesson after this builds on that." next="Next: say why →"
:::

Run it a couple of times. The wording changes from run to run, but the facts
and the shape should hold, because you pinned them down.

:::rabbithole
- read "Prompting best practices: Be clear and direct" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
- video "AI prompt engineering: A deep dive" by="Anthropic" mins=77 deep url="https://www.youtube.com/watch?v=T9aRN5JkmL8"
:::
