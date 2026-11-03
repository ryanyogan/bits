---
# sources (checked 2026-11-03, Firecrawl, maxAge 0):
# - Matt Pocock (AI Hero), My 'Grill Me' Skill Went Viral (a few-line prompt: the model
#   interviews you branch by branch through the decision tree, recommending an answer for
#   each question; works for non-coding decisions too)
#   https://www.aihero.dev/my-grill-me-skill-has-gone-viral
#   https://www.aihero.dev/skills-grilling
# - mattpocock/skills README (MIT; /grill-me for non-code uses, /grill-with-docs adds a
#   glossary and decision records for a repo; install: claude plugin install
#   mattpocock-skills@claude-plugins-official)
#   https://github.com/mattpocock/skills
# - Claude Code docs, Extend Claude with skills (a SKILL.md: frontmatter whose description
#   helps Claude decide when to load it, then the instructions; the folder name becomes the
#   /command; skills follow the Agent Skills open standard)
#   https://code.claude.com/docs/en/skills
# Toy: the compared replies are illustrative.
title: "Let Claude interview you"
order: 12
minutes: 7
xp: 60
module: Prompt with tools
---

Every lesson so far had you write down what you want. But sometimes you
**don't know yet**. You have an idea ("a bot that reminds my team about
birthdays") and a dozen decisions you haven't noticed you need to make.

Ask Claude to build it straight away and it fills each of those gaps with a
guess. The result looks finished and is built on choices you never made.

The fix is to turn the prompt around: **let Claude interview you first.**

---

Matt Pocock calls this **grilling**. His "grill me" prompt is only a few
lines long, and it went viral among people who build with AI. The shape is
simple:

- Claude asks **one question at a time**, so you can think about each one.
- For each question, Claude **recommends an answer**, so you can often just
  say "yes" and keep moving.
- It keeps going **until the two of you agree on every decision**, and
  only then writes the plan, spec or code.

:::compare{left="Build it" right="Interview first" illustrative}
- prompt "I want a bot that reminds my team about birthdays."
- left "Here's a Slack bot in Python that reads birthdays from a CSV and posts at 9am UTC every day…"
- right "First question: where should the reminders appear? I'd suggest your team's Slack channel, since that's where people already chat. Does that work, or somewhere else?"
:::

The left reply chose Slack, Python, a CSV and a time zone for you. The right
one asked about the first of those, offered a sensible default, and waited.

---

You'll write this prompt often enough that it's worth saving. That's what a
**skill** is: a saved prompt (a `SKILL.md` file) that Claude Code loads when
its description matches what you're doing, or when you type its name, like
`/grill-me`. Matt Pocock publishes his, MIT-licensed, in
`mattpocock/skills`. The **Work with coding agents** course shows how to
write your own.

:::ask{id="why-recommend" xp=10}
Why ask Claude to recommend an answer with each question?
- choice "“So Claude does all the deciding.”" "Not quite. You still decide. The recommendation is a starting point you can accept or change."
- choice "“So you can say yes to sensible defaults and spend your thinking on the questions that matter.”" correct "Right. Most questions have an obvious answer; the recommendation lets you move fast on those."
- choice "“Because Claude can't ask questions without one.”" "It can. The recommendation just makes each answer quicker for you."
:::

---

Your turn. Write an interview-first prompt for the birthday bot. Ask Claude
to **ask one question at a time**, to **recommend an answer** for each, and
to **wait** before writing any plan or code. Run it and check that you get
exactly one question back.

:::prompt{id="grill-me" xp=50 coach}
Turn the prompt around: have Claude interview you about the birthday bot

- goal "Get one clear question back, with a recommended answer, and no plan or code yet"
- placeholder "I want to build … Before you write anything, interview me … one question at a time … recommend … wait …"
- draft "Build me a bot that reminds my team about birthdays."
- check "Describes the idea"                 /birthday/i
- check "Asks to be interviewed"             /interview|ask me|question|grill/i
- check "One question at a time"             /one question|one at a time|single question|a question at a time/i
- check "Asks for a recommended answer"      /recommend|suggest|default|your best guess|propose/i
- check "Says wait before building"          /before (you|writing|building|any)|don.t (write|build|start)|wait|until (we|I)|not yet/i
- expect "Asks a question"                   match /\?/
- expect "Short"                             words<=90
- rubric "Asks about one real decision for the bot (a “does that work?” on the same decision still counts as one)" must evidence
- rubric "Recommends an answer to that question" must evidence
- rubric "Only asks: no plan, spec or code in the reply" must
- hint "Count the decisions the reply asks about. Is it one, and could you answer it in a sentence?"
- hint "Say “one question at a time” and “recommend an answer for each”, and tell Claude not to write anything until you're done."
- hint for="Only asks: no plan, spec or code in the reply" "Claude jumped ahead. Add: don't write a plan or any code until I say we're done."
- reference "I want to build a bot that reminds my team about birthdays. Before you write any plan or code, interview me about it. Ask one question at a time, and for each question give your recommended answer so I can just say yes. Keep going until we agree on every decision; then I'll ask for the plan."
- run temperature=[1.0]
- example T=1.0 "Where should the reminders show up? I'd recommend your team's Slack channel, since that's where people already talk. Shall we go with that?"
- example T=1.0 "First question: where will the birthdays come from? My recommendation: a simple shared spreadsheet, because anyone on the team can update it. Does that work for you?"
- example T=1.0 "Let's start with the audience. Who should get the reminder: the whole team, or just the birthday person's manager? I'd suggest the whole team, a day ahead, so there's time to plan something."
- success "One question, one recommendation, no guesses. Keep answering and you'll have a plan built on your decisions, not Claude's." next="Next: checkpoint →"
:::

:::rabbithole
- read "My 'grill me' skill went viral" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/my-grill-me-skill-has-gone-viral"
- read "Skills for real engineers (grill-me and more)" by="Matt Pocock" url="https://github.com/mattpocock/skills"
- read "Extend Claude with skills" by="Anthropic" deep url="https://code.claude.com/docs/en/skills"
:::
