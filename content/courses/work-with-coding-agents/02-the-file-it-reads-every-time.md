---
# sources (checked 2026-11-03):
# - Claude Code docs, How Claude remembers your project (CLAUDE.md locations: ./CLAUDE.md or
#   ./.claude/CLAUDE.md, ~/.claude/CLAUDE.md, ./CLAUDE.local.md; AGENTS.md read when there's no
#   CLAUDE.md or CLAUDE.local.md, Claude Code v2.1.277+; /init; @path imports; under 200 lines;
#   leave out what Claude can derive from the code; multi-step procedures belong in skills;
#   /memory to view and edit)
#   https://code.claude.com/docs/en/memory
# - AI Hero (Matt Pocock), A complete guide to AGENTS.md (keep it small; point to details;
#   ideas credited, words our own)
#   https://www.aihero.dev/a-complete-guide-to-agents-md
# Toy: the compared files are illustrative. Moon Café's repo is made up.
title: "The file it reads every time"
order: 2
minutes: 7
xp: 50
module: The agent and you
---

Every Claude Code session starts fresh. It doesn't remember yesterday's
chat. What it does read, every single time, is your project's **context
file**: `CLAUDE.md` at the root of the repo. It's plain markdown, and it goes
into the context window before your first message.

:::new
Think of it as the note you'd leave a capable new colleague on day one: how
to run things, the house rules, and the traps. Not a tour of the codebase;
they can read that themselves.

Where it lives (checked November 2026):

- `./CLAUDE.md` in your project, shared with your team through git.
- `~/.claude/CLAUDE.md` for your own habits across every project.
- `./CLAUDE.local.md` for personal notes on one project (add it to
  `.gitignore`).

Many tools share a file called `AGENTS.md`. Claude Code reads it when the
project has no `CLAUDE.md`.
:::

:::engineer
Load order and scope (checked November 2026): managed policy, then
`~/.claude/CLAUDE.md`, then the project's `./CLAUDE.md` or
`./.claude/CLAUDE.md`, then `./CLAUDE.local.md` (gitignored, personal).
Subdirectory `CLAUDE.md` files and `.claude/rules/*.md` with `paths`
frontmatter load on demand when Claude works there. `@path/to/file` imports
another file. `AGENTS.md` is read only when no `CLAUDE.md` or
`CLAUDE.local.md` exists (Claude Code v2.1.277 or later), so a repo that
serves several agents can keep `AGENTS.md` and import it from a one-line
`CLAUDE.md`.
:::

---

What earns a line? Anthropic's guide keeps it to facts Claude needs **every
session**: build and test commands, conventions, "always do X" rules, and the
gotchas it can't work out from the code. Aim for **under 200 lines**; a long
file costs context and gets followed less.

What doesn't: anything Claude can read for itself (folder layouts,
dependency lists, an architecture essay), and long step-by-step procedures,
which belong in a **skill** (lesson 4). A good habit, from the docs and
from Matt Pocock's AGENTS.md guide: when you correct Claude for the same
thing **twice**, add one line.

:::compare{left="Bloated" right="Lean" illustrative}
- prompt "Part of a CLAUDE.md for Moon Café's site"
- left "This is a website for Moon Café, a café that opened in 2019. The src folder contains the source code. The tests folder contains the tests. We use TypeScript, which is a typed superset of JavaScript. Please write good, clean code and follow best practices at all times."
- right "Use pnpm, never npm. pnpm test runs vitest; run it before you say you're done. Never edit src/generated/: run pnpm codegen instead. Ask before running pnpm deploy."
:::

Every line on the right changes what the agent does. Most lines on the left
change nothing, or tell it what it can already see.

---

You can generate a starting file with `/init`, which reads your codebase and
drafts one, then trim it. To see what's loaded, run `/memory`.

Your turn. Write a short `CLAUDE.md` for Moon Café's site from these facts:
the project uses **pnpm** (not npm), **`pnpm test`** runs the tests, files in
`src/generated/` are made by `pnpm codegen` and must never be edited by hand,
and deploys need a human's OK. Then, on the last line, ask what an agent
would: **how do I run the tests?** Claude here answers from your file, the
same way Claude Code would.

:::prompt{id="lean-claude-md" xp=50 coach}
Write a lean CLAUDE.md, then ask it how to run the tests

- goal "Write a short context file with only what an agent needs every session, and see Claude answer from it"
- placeholder "# Moon Café site\n- Use pnpm, never npm.\n- …\n\nHow do I run the tests?"
- draft "# Moon Café\nThis is the website for Moon Café. Please write clean code and follow best practices.\n\nHow do I run the tests?"
- check "Says to use pnpm"              /\bpnpm\b/i
- check "Gives the test command"        /pnpm test/i
- check "Protects the generated files"  /generated/i
- check "Keeps deploys human"           /deploy/i
- check "Asks how to run the tests"     /\?/
- expect "Answers with pnpm test"       match /pnpm test/i
- expect "Short"                        words<=80
- rubric "Every line is something the agent couldn't see for itself in the code" must on=prompt
- rubric "Has no generic advice like “write clean code”" should on=prompt
- rubric "Answers with the pnpm command, not npm or a guess" must
- hint "Read each line and ask: would the agent behave differently without it? Delete the ones that wouldn't."
- hint "Write the rules as commands the agent can follow: “Never edit src/generated/: run pnpm codegen.”"
- reference "# Moon Café site\n- Use pnpm, never npm.\n- pnpm test runs the tests. Run it before saying you're done.\n- Never edit src/generated/ by hand: run pnpm codegen.\n- Ask a human before running pnpm deploy.\n\nHow do I run the tests?"
- run temperature=[1.0]
- example T=1.0 "Run pnpm test. The project uses pnpm, so don't use npm, and run the tests before you say a change is done."
- example T=1.0 "Use pnpm test from the project root."
- example T=1.0 "pnpm test runs the suite. (Not npm test: this project uses pnpm.)"
- success "Short, specific, and every line changes what the agent does." next="Next: plan → build → review →"
:::
Now delete the `pnpm test` line and ask again. What does Claude have to
guess this time?

:::rabbithole
- read "How Claude remembers your project" by="Anthropic" url="https://code.claude.com/docs/en/memory"
- read "A complete guide to AGENTS.md" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/a-complete-guide-to-agents-md"
:::
