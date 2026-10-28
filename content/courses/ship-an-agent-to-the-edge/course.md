---
title: "Ship an agent to the edge"
track: agents
level: advanced
order: 8
summary: "Take your agent from a script to a deployed endpoint with memory, limits and logs."
outcomes:
  - "Deploy a Claude-powered endpoint on Cloudflare Workers, with the API key kept server-side."
  - "Give each user their own agent with memory, using the Agents SDK and Durable Objects."
  - "Put AI Gateway, rate limits, turn caps and a token budget between your agent and your bill."
  - "Log every turn as structured JSON, and keep tool results and model output from making security decisions."
cover:
  pattern: crosshatch
  sigil: "edge"
  tone: ion
badge:
  name: "Ship an agent to the edge"
  glyph: "edge"
exercise: deploy the weather agent from “Your first agent loop” as a Worker, with memory, limits and logs.
---

Your agent loop works on your laptop. This course puts it on the internet:
a Cloudflare Worker that streams Claude's replies, one agent per user with
its own memory, AI Gateway in front of the model, limits that protect your
bill, logs you can search, and the two safety rules every deployed agent
needs. You finish by shipping the weather agent.
