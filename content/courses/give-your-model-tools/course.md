---
title: "Give your model tools"
track: tools
level: intermediate
order: 60
repo: https://github.com/ryanyogan/klippy
summary: "Give Klippy real tools: the weather, the time, notes in a database and links it can read. Then ship it."
outcomes:
  - "Write a tool with a name, a description and a schema that Claude uses correctly."
  - "Watch one round trip in your logs: Claude asks, your code runs the tool, Claude answers."
  - "Store notes in D1 with a migration, and give Claude tools that write."
  - "Choose when Claude calls with toolChoice, and turn bad input and failed calls into honest errors."
  - "Reuse a ready-made tool safely, and know the lethal trifecta when you see it."
cover:
  pattern: rings
  sigil: "fn()"
  tone: synapse
badge:
  name: "Give your model tools"
  glyph: "fn()"
exercise: "write a tool description, then test which messages should call it."
---

A model on its own can't look anything up, can't be trusted with exact
maths and can't act. Tools fix that. Starting from the Klippy you shipped in
Your first Worker, you'll give it the weather, the time, notes in a
database and links it can read, watch every round trip in your logs, guard
each tool's input, and ship it again for bits to check.
