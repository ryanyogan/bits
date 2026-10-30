---
title: Animation blocks
order: 4
minutes: 6
xp: 0
illustrative: true
---

One reply is a loop of five moves.

:::steps{title="One reply, five moves" loop}
- "Read" "Everything so far, your prompt included."
- "Score" "One number for every token it knows."
- "Odds" "The scores become odds that add up to 100%."
- "Draw" "One token is sampled from those odds."
- "Append" "It joins the text, and the loop starts again."
:::

The window has a fixed size.

:::flow{capacity=8 title="A window of 8 tokens"}
- "system prompt" 3
- "Hi, I'm Sam." 2
- "Hi Sam!" 2
- "What's my name?" 2
- "Sam." 1
:::

One agent turn, in time.

:::marbles{duration=5 unit="s" title="One agent turn" illustrative=false}
- "You" 0 "prompt"
- "Claude" 0.8 "tool call" 4.6 "answer"
- "Tool" 1.2 "running" 3.9 "result"
:::
