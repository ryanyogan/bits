---
title: "Context is everything"
track: prompting
level: intermediate
order: 4
summary: "What fits in the window, what falls out, and how to pack it so the model notices."
outcomes:
  - "Say what counts toward Claude's context window, and how big it is."
  - "Explain why more context isn't automatically better (context rot)."
  - "Pack long documents so Claude finds what matters: docs first, tagged, question last."
  - "Keep a growing conversation in budget with summaries and prompt caching."
  - "Decide what to leave out."
cover:
  pattern: grid
  sigil: "[ctx]"
  tone: ion
badge:
  name: "Context is everything"
  glyph: "[ctx]"
exercise: "pack a document into a prompt so Claude quotes the line that answers your question."
---

Claude only knows what's in front of it. This course is about that space:
what goes into the context window, why stuffing it full backfires, how to
lay out long documents and long chats so the model notices what matters,
and how prompt caching makes a big, stable prefix cheap.
