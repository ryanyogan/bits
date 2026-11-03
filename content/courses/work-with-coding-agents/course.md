---
title: "Work with coding agents"
track: agents
level: beginner
order: 9
summary: "Claude Code in your repo: what a coding agent does, the context file it reads, plan → build → review, skills, MCP servers, subagents and hooks. Write each brief yourself and get coached on it."
outcomes:
  - "Explain what a coding agent does in your repo: a loop that reads, edits, runs and checks."
  - "Write a short CLAUDE.md with what the agent can't work out for itself."
  - "Brief an agent so it plans first, keeps the change small and proves it worked."
  - "Add skills and MCP servers, and know when a subagent or a hook is the right tool."
cover:
  pattern: grid
  sigil: "/cc"
  tone: synapse
badge:
  name: "Agent wrangler"
  glyph: "/cc"
exercise: "brief a coding agent so it plans first, stays in scope and proves the change works."
---

A coding agent is Claude working in your repo: it reads files, edits them,
runs your commands and checks its own work. This course shows you how to work
with one well. You'll write the briefs, context files, skills and subagent
definitions yourself, and Claude coaches each one. Everything is shown in
**Claude Code**, the agent the build-along courses use next.
