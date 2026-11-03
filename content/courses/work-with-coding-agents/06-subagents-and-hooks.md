---
# sources (checked 2026-11-03):
# - Claude Code docs, Create custom subagents (.claude/agents/ and ~/.claude/agents/; markdown
#   with frontmatter name, description, tools, model, …; each subagent has its own context
#   window; Claude delegates when a task matches the description, or you ask by name)
#   https://code.claude.com/docs/en/sub-agents
# - Claude Code docs, Automate actions with hooks (shell commands at lifecycle events; settings
#   in ~/.claude/settings.json, .claude/settings.json, .claude/settings.local.json; PreToolUse,
#   PostToolUse, Stop, …; exit 2 blocks with a reason on stderr; /hooks; the prettier example)
#   https://code.claude.com/docs/en/hooks-guide
# - Claude Code docs, Best practices (subagents for parallel work, long output and a reviewer
#   that hasn't seen the code; "never" rules belong in deny rules or hooks, not prompts)
#   https://code.claude.com/docs/en/best-practices
# - Claude Code docs, Best practices, "What you can stop doing" (re-checked 2026-11-03: subagents
#   are for parallel work, noisy output and independent review, not saving context; they cost
#   extra tokens and don't improve the same answer)
# - Claude Code docs, Configure permissions (deny rules: "deny": ["Bash(git push *)"])
#   https://code.claude.com/docs/en/permissions
# - AI Hero (Matt Pocock), hooks that enforce the right CLI (ideas credited, words our own)
#   https://www.aihero.dev/how-to-use-claude-code-hooks-to-enforce-the-right-cli
# Toy: none. The isOpen bug is our own example.
title: "Subagents and hooks"
order: 6
minutes: 8
xp: 60
module: Bigger jobs
verified: 2026-11-03
versions:
  claude-code: "2.1.317"
---

Two more tools for bigger jobs. A **subagent** is a helper Claude can hand
a task to. A **hook** is a rule that runs every time, whether Claude
remembers it or not.

:::new
**Subagents.** A subagent is a separate Claude with its **own context
window**, its own instructions and, if you like, fewer tools. Claude hands
it a job ("search the codebase for every place we format dates") and gets
back a short answer instead of pages of search results. Use one to:

- run independent jobs side by side;
- keep noisy output, like a big search or a long log, out of your way;
- review code it didn't write, with fresh eyes.

Each one costs extra tokens, and handing a job to a subagent doesn't make
the answer smarter by itself. The fresh eyes are what help a review.

A subagent is a markdown file in `.claude/agents/` (or `~/.claude/agents/`
for every project). Claude uses it when a task matches its description, or
when you ask for it by name.
:::

:::engineer
**Subagents** run in their own context window with their own system prompt,
tool allowlist and optionally model, and return only a summary to the main
thread. That buys parallelism, noisy output kept out of the main thread,
least privilege (a reviewer with `Read, Grep, Glob` can't edit) and an
unanchored reviewer. It doesn't buy a better answer to the same task, and
with 1M-token windows and automatic compaction, saving context is rarely
the reason any more; each subagent spends its own tokens. Definitions live
in `.claude/agents/*.md` or `~/.claude/agents/*.md`; Claude delegates when a
task matches the `description`, or when you name or @-mention the subagent.
:::

```
---
name: code-reviewer
description: Reviews a change for bugs and edge cases. Use after code is written, before committing.
tools: Read, Grep, Glob
---

You review code you didn't write. Look for wrong conditions, missed edge
cases and missing tests. List each problem with the line and a fix.
Don't rewrite the code.
```

---

**Hooks.** A rule in `CLAUDE.md` is advice: Claude usually follows it.
Anthropic's guide is blunt that a prompt can't **guarantee** anything. When
something must always (or never) happen, use a hook: a shell command Claude
Code runs at a set moment, like after every file edit or before every
command.

:::new
Hooks live in your settings file, `.claude/settings.json`. This one, from
Claude Code's docs, formats every file Claude edits with Prettier:
:::

:::engineer
Hooks are configured under `hooks` in `~/.claude/settings.json`,
`.claude/settings.json` or `.claude/settings.local.json`, keyed by event
(`PreToolUse`, `PostToolUse`, `Stop`, `SessionStart` and more), each with a
tool `matcher`. The command gets the event as JSON on stdin. Exit `0` lets
things proceed; exit `2` blocks the action and sends your stderr back to
Claude as the reason. A `Stop` hook that exits 2 sends Claude back to work,
so "tests must pass before you finish" becomes enforceable. `/hooks` lists
what's configured. The docs' formatter example:
:::

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

For a plain "never run this command", a **deny rule** in the same settings
file does the job with no script: `"permissions": { "deny": ["Bash(npm
*)"] }`. Use a hook when you need logic or a custom message.

A hook runs real commands on your machine with your permissions, so treat
one you didn't write like any other script: read it first.

:::quiz{id="right-tool" xp=20}
Your team must never run `npm` in a pnpm repo. Claude did it twice last week. What's the most reliable fix?

- [ ] Add “never use npm” to CLAUDE.md in capitals
  Worth adding, but it's still advice. Claude can slip, as it already has.
- [x] A PreToolUse hook that blocks any command starting with npm, with a message to use pnpm
  Right. It runs every time, and exit 2 tells Claude why and what to do instead. A deny rule for Bash(npm *) is the no-script version.
- [ ] A subagent that checks commands
  Not quite. A subagent is another Claude: it can miss things too, and it only runs when called.
:::

---

Your turn. Write a reviewer subagent in your own words: a description that
says when to use it, read-only tools, and instructions. Then, after the file,
hand it this function to review: **`function isOpen(hour) { return hour > 7
&& hour < 18 }`**. Moon Café opens at 7:00 and closes at 18:00. Claude
plays your subagent here.

:::prompt{id="reviewer-subagent" xp=40 coach}
Define a reviewer subagent, then hand it code with a bug in it

- goal "Write a subagent with a clear trigger and read-only tools, and see it catch the opening-hour bug"
- placeholder "---\nname: …\ndescription: … Use when …\ntools: Read, Grep, Glob\n---\n\nYou review …\n\nReview: function isOpen(hour) { return hour > 7 && hour < 18 } (opens 7:00, closes 18:00)"
- draft "You are a code reviewer. Review this: function isOpen(hour) { return hour > 7 && hour < 18 }"
- check "Has a description line"         /description:/i
- check "Says when to use it"            /\buse (it |this )?(when|after|before)|\bwhen (code|a change|you|the user)/i
- check "Limits its tools"               /tools:/i
- check "Hands it the function"          /isopen/i
- check "Gives the opening hours"        /7:00|opens? (at )?7|7 ?am/i
- expect "Catches the 7 o'clock bug"     match />=|7:00|\b7\b|seven|opening hour|edge case|boundary|off.by.one/i
- rubric "The description says when the subagent should be used" must on=prompt
- rubric "Keeps the reviewer read-only, so it reports instead of editing" should on=prompt
- rubric "Points out that the café shows closed at 7 o'clock, when it has just opened" must
- hint "Will Claude know when to hand work to this subagent? Put the trigger in the description."
- hint "Give the reviewer the business rule (opens at 7:00), or it can't know 7 should count as open."
- reference "---\nname: code-reviewer\ndescription: Reviews a change for bugs and edge cases. Use after code is written, before committing.\ntools: Read, Grep, Glob\n---\n\nYou review code you didn't write. Check conditions against the business rules, look for edge cases, and list each problem with a fix. Don't rewrite the code.\n\nReview this. Moon Café opens at 7:00 and closes at 18:00:\nfunction isOpen(hour) { return hour > 7 && hour < 18 }"
- run temperature=[1.0]
- example T=1.0 "One bug: at hour 7 the café has just opened, but hour > 7 returns false, so it shows as closed from 7:00 to 7:59. Use hour >= 7. The upper bound is right: at 18 it's closed. Add tests for 6, 7, 17 and 18."
- example T=1.0 "Edge case at opening time: isOpen(7) is false because of > 7. It should be >= 7. Closing looks correct (hour < 18). Suggest boundary tests for 7 and 18."
- example T=1.0 "Off-by-one at the start of the day: change hour > 7 to hour >= 7, or 7:00–7:59 counts as closed. Everything else matches the rule."
- success "A clear trigger, read-only tools, and a reviewer that caught the edge case." next="Next: checkpoint →"
:::
:::rabbithole
- read "Create custom subagents" by="Anthropic" url="https://code.claude.com/docs/en/sub-agents"
- read "Automate actions with hooks" by="Anthropic" url="https://code.claude.com/docs/en/hooks-guide"
- read "Hooks that enforce the right CLI" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/how-to-use-claude-code-hooks-to-enforce-the-right-cli"
:::
