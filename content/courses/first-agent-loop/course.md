---
title: Your first agent loop
track: agents
level: intermediate
order: 70
repo: https://github.com/ryanyogan/klippy
summary: "Turn Klippy into an agent: one per person, a chat in your terminal, a memory, approvals and reminders."
outcomes:
  - Write the tool-calling loop by hand once, and know what stopWhen does for you.
  - Give each person their own agent, with its own stored chat, on a Durable Object.
  - Talk to it from your terminal over one WebSocket, with replies that stream.
  - Add long-term memory, approvals before writes, and limits that stop runaway loops.
  - Let it act unasked, on a schedule, without giving those turns any tools.
cover:
  pattern: rays
  sigil: loop
  tone: volt
badge:
  id: first-agent-loop
  name: Loop Closer
  glyph: ↻
exercise: write the message a reminder sends to the model, so it speaks and does nothing else.
---

Plan, act, observe, repeat. Starting from the Klippy you gave tools in
Give your model tools, you'll write the loop by hand once, then make Klippy
a real agent: one per person, a chat in your terminal, a memory that
outlives the chat, approvals before it writes, limits that stop a runaway
loop, and reminders it sends on its own. Then ship it for bits to check.
