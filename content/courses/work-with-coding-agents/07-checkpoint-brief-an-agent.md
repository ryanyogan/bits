---
# sources (checked 2026-11-03):
# - Claude Code docs, Best practices (tell Claude what it can't see; give it a check to run; ask
#   for evidence; "never" rules belong in hooks or deny rules)
#   https://code.claude.com/docs/en/best-practices
# - Claude Academy, Claude Code 101 (Explore → Plan → Code → Commit)
#   https://academy.claude.com/courses/claude-code-101
# - Claude Code docs, Connect Claude Code to tools via MCP (Context7 for current docs)
#   https://code.claude.com/docs/en/mcp
# Toy: none. Klippy's repo layout follows docs/plans/build-along.md; the brief is our example.
title: "Checkpoint: brief an agent"
order: 7
minutes: 8
xp: 80
module: Bigger jobs
project: true
---

Time to put the whole course into one brief. In the build-along courses
you'll build **Klippy**, a personal agent on Cloudflare, and a lot of it,
the front end especially, you'll build by briefing Claude Code. This is the
kind of brief you'll write there.

A brief that works has the same parts every time:

1. **Goal.** What should exist when it's done, in one or two sentences.
2. **Where.** The files or folder, and the pattern to follow.
3. **Docs.** Which source to check for anything version-sensitive
   (Context7 for library docs; a skill like Remix's or Cloudflare's if it's
   installed).
4. **Out of scope.** What not to touch, and no new packages unless asked.
5. **Done means.** A check that passes or fails, and the output as proof.
6. **Plan first.** Reply with the plan before editing.

What it leaves out matters too. The house rules (pnpm, never edit generated
files) are already in `CLAUDE.md`, so the brief doesn't repeat them, and
anything that must never happen is a hook, not a sentence.

---

Checkpoint. Klippy saves notes. Brief an agent to add a **notes page** to
the web app at `apps/web`: a list of the person's saved notes, newest first,
that reads them from the agent's existing `listNotes` method. Use the
Remix skill and check current docs with Context7. Include all six parts.
Claude replies with the plan it would follow.

:::prompt{id="brief-an-agent" xp=80 coach}
Write a complete brief: goal, where, docs, out of scope, done means, plan first

- goal "Get a plan for a notes page that follows your brief: right place, current docs, tight scope and a check to finish"
- placeholder "Goal: a notes page … Where: apps/web … Docs: … Context7 … Out of scope: … Done means: … Reply with your plan first."
- draft "Make a notes page for Klippy."
- check "States the goal"             /notes page|list of (the )?notes|newest first/i
- check "Says where"                  /apps\/web/i
- check "Names the data source"       /listnotes/i
- check "Points to docs or a skill"   /context7|remix skill|\bskill\b|\bdocs\b/i
- check "Limits the scope"            /\bonly\b|don.t|do not|nothing else|no new|out of scope/i
- check "Says what done means"        /\btests?\b|typecheck|pnpm|output|done means/i
- check "Asks for a plan first"       /\bplan\b/i
- expect "Replies with a plan"        match /plan|step|\b1\.|first/i
- rubric "Says what done looks like with a check that passes or fails" must on=prompt
- rubric "Names what's out of scope, such as new packages or other pages" must on=prompt
- rubric "Tells the agent where to check current docs before using an API" should on=prompt
- rubric "Doesn't repeat house rules that belong in CLAUDE.md, or “never” rules that belong in a hook" should on=prompt
- rubric "The plan follows the brief: apps/web, listNotes, newest first" must
- hint "Could the agent tell when it's finished? Name the check and ask to see its output."
- hint "What could it wander into? New packages, other pages, a refactor? Rule them out."
- hint "Read your brief as a stranger would. Which of the six parts would they have to guess?"
- reference "Goal: add a notes page to Klippy's web app that lists the person's saved notes, newest first.\nWhere: apps/web. Read the notes with the agent's existing listNotes method; follow the pattern of the existing pages.\nDocs: use the Remix skill, and check current Remix and Agents SDK APIs with Context7 before using them.\nOut of scope: no new packages, and don't change other pages or the agent.\nDone means: pnpm typecheck passes and the page lists notes in local dev; show me the typecheck output.\nReply with your plan before editing."
- run temperature=[1.0]
- example T=1.0 "Plan:\n1. Read the existing pages in apps/web and the Remix skill for the route pattern.\n2. Check Context7 for the current Remix and Agents SDK APIs I'll use.\n3. Add the notes route, calling listNotes and sorting newest first.\n4. Run pnpm typecheck, show you the output, and check the page in local dev.\nNo new packages, and nothing outside the notes page changes."
- example T=1.0 "Here's my plan: look at how the current pages in apps/web are built, confirm the APIs with Context7, then add a notes page that calls listNotes and shows the newest first. I'll finish by running pnpm typecheck and sharing the output. I won't add packages or touch the agent."
- example T=1.0 "Step 1: follow an existing page's pattern in apps/web. Step 2: check the current docs via Context7. Step 3: build the notes list from listNotes, newest first. Step 4: run pnpm typecheck and paste the result."
- success "Goal, where, docs, scope, done and plan first. You can brief an agent." next="Finish the course →"
:::
Finish this checkpoint and the **Agent wrangler** badge is yours. You can
say what a coding agent does, keep a lean `CLAUDE.md`, brief changes that
are small and proven, and add skills, MCP servers, subagents and hooks.
Next, **Your first Worker** starts the Klippy build-along, and in **Build
the front end with agents** you'll write briefs like this one for real.

:::rabbithole
- read "Best practices for Claude Code" by="Anthropic" url="https://code.claude.com/docs/en/best-practices"
- read "Claude Code in action" by="Claude Academy" url="https://academy.claude.com/courses/claude-code-in-action"
- read "Introduction to subagents" by="Claude Academy" url="https://academy.claude.com/courses/introduction-to-subagents"
:::
