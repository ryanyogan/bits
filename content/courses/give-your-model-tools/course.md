---
title: "Give your model tools"
track: tools
level: intermediate
order: 5
summary: "Describe a function, let Claude call it, feed back the result. Build a weather bot on real data."
outcomes:
  - "Describe a tool with a name, a description and a JSON Schema that Claude uses correctly."
  - "Handle one full round trip: tool_use in, your code runs it, tool_result back."
  - "Control calls with tool_choice, strict schemas, parallel calls and is_error results."
  - "Know when to reach for Anthropic's server tools or an MCP server instead of writing your own."
cover:
  pattern: rings
  sigil: "fn()"
  tone: synapse
badge:
  name: "Give your model tools"
  glyph: "fn()"
exercise: "write a tool description, then test which messages should call it."
---

A model on its own can't look anything up, can't be trusted with exact maths and can't
act. Tools fix that. You'll describe a function, watch Claude ask for it,
run it, hand back the result, and finish with a weather bot in TypeScript
that answers from live data.
