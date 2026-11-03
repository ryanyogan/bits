---
# sources (checked 2026-11-03):
# - Claude Code docs, Extend Claude with skills (paths: ~/.claude/skills/<name>/SKILL.md,
#   .claude/skills/<name>/SKILL.md, <plugin>/skills/<name>/SKILL.md; description loads into
#   context, the body only when the skill is used; invoke with /skill-name; description and
#   when_to_use truncated at 1,536 characters; /plugin marketplace add, /plugin install)
#   https://code.claude.com/docs/en/skills
# - Cloudflare Agent setup docs, Claude Code + Cloudflare (/plugin marketplace add cloudflare/skills,
#   /plugin install cloudflare@cloudflare: installs Cloudflare Skills and its MCP servers)
#   https://developers.cloudflare.com/agent-setup/claude-code/
# - cloudflare/skills README (also: npx skills add https://github.com/cloudflare/skills)
#   https://github.com/cloudflare/skills
# - anthropics/skills (frontend-design skill; this repo installed it with
#   npx skills add anthropics/skills --skill frontend-design, recorded in skills-lock.json)
#   https://github.com/anthropics/skills
# - npx skills (vercel-labs/skills): `npx skills add remix-run/remix --list` lists the Remix
#   repo's skills; "Use --skill <name> to install specific skills" (run 2026-11-03)
# - AI Hero (Matt Pocock), Writing skills for agents (descriptions cost context on every
#   request; ideas credited, words our own)
#   https://www.aihero.dev/skills-writing-for-agents
# Toy: none. The commit-message skill is our own example.
title: "Teach it a skill"
order: 4
minutes: 8
xp: 60
module: Give it more to work with
---

Your `CLAUDE.md` holds what the agent needs every session. But some know-how
is only needed sometimes: how your team writes commit messages, how to build
a Cloudflare Worker, how to design a page that doesn't look generic. That's
what a **skill** is for.

:::new
A skill is a folder with a `SKILL.md` file in it: a short **description**
at the top, then instructions. Claude always sees the description, so it
knows the skill exists. It reads the rest **only when a task matches**. A
dozen skills cost almost nothing until one is needed.

You can also call one by name: type `/` and the skill's name.
:::

:::engineer
Skills use progressive disclosure: each skill's `description` (plus
optional `when_to_use`, together truncated at 1,536 characters in the
listing) sits in context every session; the body, and any files it points
to, load only when Claude invokes it. So the description is a routing rule:
say what it does **and when to use it**. Frontmatter can also restrict
tools (`allowed-tools`), pin a `model`, or turn off automatic use
(`disable-model-invocation`). Invoke one directly with `/skill-name`.
:::

```
---
description: Writes commit messages in our house style. Use when the user asks for a commit message or is about to commit.
---

1. First line: type(scope): summary, under 60 characters.
   Types: feat, fix, docs, refactor, test, chore.
2. Blank line, then one or two sentences on why, not what.
3. Never mention the AI or tools used.
```

Save that as `.claude/skills/commit-message/SKILL.md` in a project (or under
`~/.claude/skills/` to use it everywhere). The folder name becomes its name.

---

You don't have to write every skill yourself. The teams behind your tools
publish theirs, and the build-along courses use three (checked November
2026):

- **Cloudflare**, inside Claude Code: `/plugin marketplace add
  cloudflare/skills`, then `/plugin install cloudflare@cloudflare`. That
  adds Cloudflare's skills and its docs MCP servers (next lesson).
- **Frontend design**, from Anthropic: `npx skills add anthropics/skills
  --skill frontend-design`.
- **Remix**: the Remix team keeps its skills in the `remix-run/remix` repo.
  `npx skills add remix-run/remix --list` shows them; pick one with
  `--skill`.

`npx skills` is a small open-source installer that copies a skill's folder
into your project. A skill is instructions your agent will follow, so read
it before you install it, as you would a script.

---

Your turn. Write a tiny `SKILL.md` for commit messages in your own words,
then on the last line hand it a change to describe, like this: **Change:
the homepage now shows a “closed today” banner on Sundays.** Claude here
plays the agent that loaded your skill.

:::prompt{id="commit-skill" xp=60 coach}
Write a commit-message skill, then give it a change to describe

- goal "Write a skill whose description says when to use it, and see Claude follow its rules"
- placeholder "---\ndescription: Writes commit messages … Use when …\n---\n\n1. …\n\nChange: the homepage now shows a “closed today” banner on Sundays."
- draft "Write good commit messages.\n\nChange: the homepage now shows a closed today banner on Sundays."
- check "Has a description line"        /description:/i
- check "Says when to use it"           /\buse (it |this )?when|\bwhen (the user|you|someone|asked)/i
- check "Gives the format"              /feat|fix|type/i
- check "Hands it a change"             /change:/i
- expect "Starts with a type"           match /\b(feat|fix|docs|refactor|test|chore)(\(|:)/i
- rubric "The description says when to use the skill, not only what it does" must on=prompt
- rubric "The steps are rules a reader could check, not vague advice" should on=prompt
- rubric "The commit message follows the skill's format" must
- hint "Claude only sees the description until the skill is needed. Does yours say when it's needed?"
- hint "Make each rule checkable: a length, a list of types, what the second line is for."
- reference "---\ndescription: Writes commit messages in our house style. Use when the user asks for a commit message or is about to commit.\n---\n\n1. First line: type(scope): summary, under 60 characters. Types: feat, fix, docs, refactor, test, chore.\n2. Blank line, then one sentence on why.\n3. Reply with the message only.\n\nChange: the homepage now shows a “closed today” banner on Sundays."
- run temperature=[1.0]
- example T=1.0 "feat(home): show a closed-today banner on Sundays\n\nCustomers kept arriving on Sundays; the banner tells them before they set off."
- example T=1.0 "feat(hours): add Sunday closed banner to homepage\n\nSo visitors can see at a glance that the café is closed today."
- example T=1.0 "feat(home): add “closed today” banner\n\nShows on Sundays so people don't make a wasted trip."
- success "A clear description, checkable rules, and a reply that follows them. That's a skill." next="Next: give it new tools →"
:::
:::rabbithole
- read "Extend Claude with skills" by="Anthropic" url="https://code.claude.com/docs/en/skills"
- read "Introduction to agent skills" by="Claude Academy" url="https://academy.claude.com/courses/introduction-to-agent-skills"
- read "Writing skills for agents" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/skills-writing-for-agents"
:::
