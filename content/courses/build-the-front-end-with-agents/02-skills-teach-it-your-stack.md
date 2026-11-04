---
# sources (checked 2026-11-03):
# - Claude Code docs, Skills (SKILL.md; the description decides when it loads; /name invokes it)
#   https://code.claude.com/docs/en/skills
# - Anthropic, Equipping agents for the real world with Agent Skills
#   https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
# - The skills CLI 1.7.6 (npm, checked with `npm view skills version`); skill sources remix-run/remix,
#   cloudflare/skills, anthropics/skills
# - Klippy d-01 → d-02, docs/outputs/d-02.txt (2026-11-03, Claude Code 2.1.317). The commands were run by an agent;
#   the two `claude -p` checks are real runs.
title: "Skills: teach it your stack"
order: 2
minutes: 15
xp: 50
module: Set up the agent
device: desk
tag: d-01
verified: 2026-11-03
versions:
  claude-code: "2.1.317"
  skills: "1.7.6"
---

Remix 3 and Cloudflare's `agents` package are newer than most of what any
model was trained on. Left alone, an agent writes the Remix it remembers:
Remix 2, React, the wrong imports. A **skill** fixes that. It's a folder
with a `SKILL.md`: a description that says when to load it, and
instructions that change what the agent does, such as "read the installed
docs before using an API".

Skills load **only when they're needed**: Claude Code reads every skill's
short description up front, and the full instructions only when a task
matches. So four skills cost almost nothing until they're used.

### 1. Install four skills

From `klippy/`:

```sh
npx skills@1.7.6 add remix-run/remix -s remix -a claude-code -y
npx skills@1.7.6 add cloudflare/skills -s cloudflare -s agents-sdk -a claude-code -y
npx skills@1.7.6 add anthropics/skills -s frontend-design -a claude-code -y
```

- **remix**, from the Remix team: read the installed docs first; routes,
  router and controllers the Remix 3 way.
- **cloudflare**: pick the right Cloudflare product, then its docs.
- **agents-sdk**: the `agents` package (`AIChatAgent`, `AgentClient`),
  which the chat in lesson 9 builds on.
- **frontend-design**, from Anthropic: choose a deliberate look, not a
  template's defaults.

They land in `.claude/skills/`, and `skills-lock.json` records each one's
source and a hash of its contents. Add `.claude/skills/` to `.gitignore`
and commit the lock: the skills are other people's files (MIT and
Apache-2.0), and a fresh clone restores them with
`npx skills@1.7.6 experimental_install`. That command's name says
experimental; the three `add` lines above are the stable path.

### 2. Ask what changed

Start a fresh session (`/clear`), then:

```text
Goal: explain the four skills just installed in .claude/skills, so I know when each one changes what you do.
Read each SKILL.md's frontmatter and first section only.
Constraints:
- Don't change any file. This is a read-only step.
- For each skill: its name, when it loads (from its description), and one thing it makes you do differently.
Done when you've covered remix, cloudflare, agents-sdk and frontend-design, and named the one you'd load first
to add a Remix page.
Report as a four-row table, then that one line.
```

- **Read-only, said out loud.** Nothing to review but the answer.
- **Frontmatter and first section only.** The description is what decides
  loading; the rest would spend context for nothing.
- **A table.** A short, checkable reply.

### 3. What to expect

No file changes, and a table. Our check, with one line per skill (a real
run; excerpt):

:::terminal{cmd="claude -p &quot;Without reading files: list the project skills you have available … which one you'd load first for adding a Remix page.&quot; --max-turns 1"}
- **remix**: building or changing Remix 3 routes, pages, middleware, data or UI with `remix/*` imports.
- **agents-sdk**: working on `Klippy extends AIChatAgent`, tools, scheduling or approvals in the `agents` package.
- **cloudflare**: choosing which Cloudflare product fits a new need before building it.
- **frontend-design**: choosing a deliberate visual direction for new UI so it doesn't look templated.
[muted](…plus user-level skills on this machine: durable-objects, workers-best-practices, wrangler, cf-cli, …)
**For adding a Remix page, I'd load `remix` first.**
:::

Our machine has other skills installed for the user, so the list is longer
than four. Yours will differ. It also said it couldn't tell which skills
came from this repo without reading `skills-lock.json`: one more reason to
keep the lock.

And what the remix skill actually changes:

:::terminal{cmd="claude -p &quot;Use the remix skill. In three short lines: what does it tell you to read before using an unfamiliar Remix API, in what order? Don't read any repo files.&quot; --max-turns 3"}
1. Start with the app itself: `AGENTS.md`, `package.json`, `tsconfig.json`, and the code that owns the behavior you're changing.
2. Search `node_modules/remix/INDEX.md` by task or keyword. To find a specific function, type or attribute, search `node_modules/remix/guides` and `node_modules/remix/src`.
3. Follow the index to the relevant guide, then read the package README for exact imports, options and examples. If there's no guide, use the API README and the app's existing patterns.
:::

That's the habit you want: installed docs over memory.

### 4. Review it

- `skills-lock.json` lists exactly four skills, from `remix-run/remix`,
  `cloudflare/skills` and `anthropics/skills`.
- `.claude/skills/` is gitignored (`git check-ignore .claude/skills/remix/SKILL.md`
  prints the path).
- **Reject**: a skill from a repo you don't recognise, or one whose
  description says it loads "always". A skill is instructions your agent
  follows: install only ones you trust.

Steer prompts for the usual misses:

```text
Your table describes the cloudflare skill from memory. Read .claude/skills/cloudflare/SKILL.md and quote its description line instead.
```

```text
You edited AGENTS.md. This step is read-only: revert it with git checkout AGENTS.md.
```

:::quiz{id="skill-loads-when" xp=20}
What decides when Claude Code loads a skill's full instructions?

- [ ] It loads every skill's instructions at the start of each session
  Not quite. Only the short descriptions are loaded up front. That's why skills are cheap.
- [x] The skill's description, matched against the task in front of it
  Right. Write and read descriptions with that in mind. You can also invoke one by name.
- [ ] The order they were installed in
  Not quite. Order doesn't matter; the description does.
:::

Your repo matches tag `d-02`
([changes from d-01](https://github.com/ryanyogan/klippy/compare/d-01...d-02)).

:::rabbithole
- read "Agent Skills in Claude Code" by="Anthropic" url="https://code.claude.com/docs/en/skills"
- read "Equipping agents for the real world with Agent Skills" by="Anthropic" url="https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills"
:::
