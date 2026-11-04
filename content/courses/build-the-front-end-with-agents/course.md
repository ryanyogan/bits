---
title: "Build the front end with agents"
track: agents
level: intermediate
order: 80
repo: https://github.com/ryanyogan/klippy
summary: "Direct Claude Code to build Klippy a web app: GitHub sign-in, your notes and a live chat, in Remix 3 on Workers."
outcomes:
  - Give a coding agent what it reads first, the skills for your stack and the docs it needs.
  - Write a brief, then prompts with a goal, where to look, constraints, a done-when and a report.
  - Review an agent's diff with a checklist, and steer it with prompts that quote the miss.
  - Ship a Remix 3 app on Workers that signs you in with GitHub and streams Klippy's replies.
cover:
  pattern: crosshatch
  sigil: "</>"
  tone: ion
badge:
  name: "Front End Director"
  glyph: "</>"
exercise: write a brief that gets Claude Code's plan, not its code, before it builds.
---

Klippy works from your terminal. This course gives it a web app, and you
don't type most of it: you direct Claude Code. Each lesson is a prompt you
can copy, what to expect back, a checklist for reading the diff, and the
steer prompts for the usual misses. By the end, Klippy has GitHub sign-in,
a notes page and a live chat with Approve and Deny, on the web, checked by
bits.

How this course was made, honestly: the code at each tag was written by an
agent working from the lesson's prompt, not recorded from a fresh run of
it. The checks and our review run are real, and dated. Your agent's output
will differ; the lessons teach you to judge it.
