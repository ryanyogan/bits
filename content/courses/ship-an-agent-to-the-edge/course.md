---
title: "Ship an agent to the edge"
track: agents
level: advanced
order: 100
repo: https://github.com/ryanyogan/klippy
summary: "Put Klippy into production: no side door, a gateway that labels and caches, limits and a daily budget that hold, logs you can query, tested defences, CI deploys and previews."
outcomes:
  - "Close the agent's public address (workers.dev and preview URLs) so the only way in is your signed-in web app."
  - "Label every model call for AI Gateway, and cache only what's the same for everyone, by key."
  - "Stop bursts with per-user rate limits, and cap spending with an exact daily token budget that charges before each call."
  - "Log each turn's shape as one JSON line, never its content, and query it."
  - "Prove with a test that a model which obeys a planted instruction still can't write or send data out."
  - "Deploy from CI in the right order, and preview pull requests without touching your data."
cover:
  pattern: crosshatch
  sigil: "edge"
  tone: ion
badge:
  name: "Ship an agent to the edge"
  glyph: "edge"
exercise: "turn a chat turn's log sentence into one JSON line you can filter, with nothing the user wrote in it."
---

Klippy works: it chats, uses tools, remembers, and answers from your notes.
This course gets it ready for the internet. You'll close the agent's public
address, put AI Gateway to work, add limits and a daily budget that hold,
log each turn as a line you can query, test the defences against prompt
injection, and deploy both Workers from CI with previews for pull requests.
You finish by deploying it yourself and letting bits check it.

Klippy is personal: one Klippy per GitHub account, and the web app only lets
in the GitHub ids you allow. Keep it that way. The notes table has no owner,
so put only your own id in `ALLOWED_GITHUB_IDS`.
