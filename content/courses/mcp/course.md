---
title: "MCP"
track: tools
level: advanced
order: 110
access: soon
summary: "Give Klippy's notes to any AI client: a remote MCP server in TypeScript on Cloudflare Workers, over Streamable HTTP, behind OAuth."
outcomes:
  - "Explain what the Model Context Protocol is for: tools, resources and prompts that any MCP client can use."
  - "Build a remote MCP server on Workers with createMcpHandler, served over Streamable HTTP."
  - "Expose Klippy's search and notes as MCP tools, with the same limits and locks as the chat."
  - "Put OAuth in front of it, so only you can connect, and test it from a real MCP client."
cover:
  pattern: rings
  sigil: "mcp"
  tone: synapse
badge:
  name: "MCP"
  glyph: "mcp"
---

Klippy answers from your notes in its own chat. In this course it serves
them to any AI client that speaks the Model Context Protocol. You'll build
a remote MCP server in TypeScript on Cloudflare Workers with
`createMcpHandler`, serve it over Streamable HTTP, put OAuth in front of it,
and connect to it from a real client. Coming soon.
