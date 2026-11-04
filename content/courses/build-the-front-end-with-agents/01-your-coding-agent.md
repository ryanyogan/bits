---
# sources (checked 2026-11-03):
# - Claude Code docs, Advanced setup (install commands; Firecrawl maxAge 0) https://code.claude.com/docs/en/setup
# - Claude Code docs, Memory (AGENTS.md is read when there's no CLAUDE.md; keep it under 200 lines)
#   https://code.claude.com/docs/en/memory
# - Anthropic, Claude Code best practices https://www.anthropic.com/engineering/claude-code-best-practices
# - docs/plans/build-along/prompting-practices.md (the five-part prompt)
# - Klippy c-09 → d-01, docs/outputs/d-01.txt (2026-11-03, Claude Code 2.1.317). AGENTS.md was written by an agent
#   against the prompt below, not recorded from a fresh run; the `claude -p` check is a real run.
title: "Your coding agent"
order: 1
minutes: 15
xp: 50
module: Set up the agent
device: desk
tag: c-09
verified: 2026-11-03
versions:
  claude-code: "2.1.317"
---

In this course you direct a coding agent, Claude Code, to build Klippy's
web app. Your job changes: less typing, more **briefing** and **reviewing**.
If you're joining here, start from tag `c-09` (the box above clones it),
then run `pnpm install`.

### 1. Install Claude Code

From Claude Code's setup page (macOS, Linux, WSL):

```sh
curl -fsSL https://claude.ai/install.sh | bash
```

Windows has its own line on [the setup page](https://code.claude.com/docs/en/setup).
Then start it in your repo:

```sh
cd klippy
claude
```

It asks you to sign in the first time; the setup page says which accounts
work.

### 2. What it reads first

Every session starts from nothing. Claude Code reads a short file of
project instructions before your first message, so you don't repeat
yourself each time. It reads `CLAUDE.md`, or `AGENTS.md` when there's no
`CLAUDE.md`. (Have both? Put `@AGENTS.md` at the top of `CLAUDE.md`.)

Keep it **short**: only what the agent can't learn quickly from the code.
Every line is read every session, so every line spends context.

### 3. Write it together

Paste this into Claude Code:

```text
Goal: write AGENTS.md for this repo, so every future session starts knowing how Klippy is built and checked.
Read README.md, package.json, apps/agent/package.json and apps/agent/wrangler.jsonc first. Don't read every file.
Constraints:
- Under 60 lines. Only what you can't learn quickly from the code: layout, commands, rules, "done means".
- Rules to include: read installed docs for agents/ai/remix; exact pinned versions; tests never call a real model;
  secrets only in .dev.vars and wrangler secret put; budget routes keep token, rate limit and input cap.
- Create only AGENTS.md. Don't change any other file.
Plan first: show me the outline, then wait for my go-ahead.
Done when the file exists and `wc -l AGENTS.md` is under 60.
Report the line count and anything you left out on purpose.
```

Every prompt in this course has the same five parts. Here's why each is
there:

- **Goal, with the reason.** "So every future session starts knowing…"
  lets the agent make the calls you didn't list.
- **Where to look.** Four files, not the whole repo: context is a budget.
- **Constraints.** A size cap, the rules you care about, one file only.
- **Plan first.** A wrong outline costs a sentence to fix. A wrong file
  costs a review.
- **Done when, and a report.** A check it runs itself, and what it ran and
  saw. Never "it should work".

### 4. What to expect

One new file. Ours is 30 lines: Layout, Commands, Rules, Done means. The
rules are the part that matters most:

:::code{file="AGENTS.md" lang="md" tag="d-01" label="AGENTS.md"}
## Rules

- Read the installed docs before using an API you aren't sure of (`node_modules/<pkg>/docs` or README).
  `agents`, `ai` and `remix` change fast; don't trust memory for them.
- Pin exact versions (no `^`). Check a new version with `npm view <pkg> version` the day you add it.
- Tests never call a real model or the real internet: mock `../src/model` and `fetch`.
- Secrets live in `.dev.vars` (gitignored) and `wrangler secret put`. Never write a real key into a file.
- Every route that spends model budget keeps its token check, its rate limit and its input cap.
- Keep changes small: one lesson, one change. Ask before adding a dependency.

## Done means

`pnpm typecheck` and `pnpm test` pass, and you've said what you ran and what you saw.
:::

The agent may offer `/init` instead. That's a fine start, but `/init`
writes a long file from the code: cut it down to what the code can't tell
you.

**How we made ours.** Our `AGENTS.md` was written by an agent against this
prompt, not recorded from a fresh Claude Code run. Your file will differ.
The check below is a real run.

### 5. Review it

Read the file before you keep it:

- Under 60 lines, and every line is something you'd otherwise say again in
  each session.
- The commands exist (`pnpm typecheck`, `pnpm test`). Run one to be sure.
- No secret, token or account id.
- **Reject**: a list of every source file, generic advice ("write clean
  code"), or rules you don't follow.

If it missed, say so plainly, and quote the miss:

```text
You listed every file in apps/agent/src. Remove the file list; keep only the four folders and what each holds.
```

```text
You wrote `npm run test`. This repo uses pnpm: change the commands to `pnpm …` and run `pnpm test` once to check.
```

### 6. Check it loaded

Ask a question only the file can answer, with no room to read files:

:::terminal{cmd="claude -p &quot;Without reading any files, answer from your project instructions only: what must be true before you say a change is done, and where do secrets go? Two short lines.&quot; --max-turns 1"}
Done means `pnpm typecheck` and `pnpm test` both pass, and I've said what I ran and what I saw.

Secrets go in `.dev.vars` (gitignored) for local use and in `wrangler secret put` for deployed Workers, and a real key is never written into a file.
:::

Both answers are your file's wording. `--max-turns 1` leaves no room for a
tool call, so they came from the instructions loaded at start.

:::quiz{id="agents-md-size" xp=20}
Why keep AGENTS.md short?

- [ ] Claude Code only reads the first 60 lines
  Not quite. It reads the whole file. The docs suggest under 200 lines.
- [x] Every line is read in every session, so every line spends context the task could use
  Right. Keep only what the agent can't learn quickly from the code.
- [ ] Long files can't be committed
  Not quite. Git doesn't mind. Your context window does.
:::

Your repo matches tag `d-01`
([changes from c-09](https://github.com/ryanyogan/klippy/compare/c-09...d-01)).

:::rabbithole
- read "Manage Claude's memory" by="Anthropic" url="https://code.claude.com/docs/en/memory"
- read "Claude Code best practices" by="Anthropic" url="https://www.anthropic.com/engineering/claude-code-best-practices"
:::
