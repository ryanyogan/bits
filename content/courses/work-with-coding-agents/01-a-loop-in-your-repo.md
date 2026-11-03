---
# sources (checked 2026-11-03):
# - Claude Code docs, Advanced setup (install commands; npm package @anthropic-ai/claude-code;
#   needs a Pro, Max, Ultra, Team, Enterprise or Console account; free claude.ai plan excluded)
#   https://code.claude.com/docs/en/setup
# - Claude Code docs, Choose a permission mode (default mode asks before edits, commands and
#   network; Shift+Tab cycles modes)
#   https://code.claude.com/docs/en/permission-modes
# - Claude Code docs, Best practices (vague vs specific prompts; "give Claude something it can
#   run that comes back pass or fail"; ask for evidence)
#   https://code.claude.com/docs/en/best-practices
# - Claude Academy, Claude Code 101 (the agentic loop: gather context, take action, verify)
#   https://academy.claude.com/courses/claude-code-101
# Toy: the step captions describe the loop; no live run. Moon Café's repo is made up.
title: "A loop in your repo"
order: 1
minutes: 7
xp: 50
module: The agent and you
---

You've used Claude in a chat. A **coding agent** is Claude with hands: it
works inside your project folder, reads your files, edits them, runs your
commands and looks at what happened. **Claude Code** is Anthropic's coding
agent, and it's the one this course and the build-along courses use.

:::new
Under the hood it's the same loop you'll build yourself in **Your first agent
loop**: Claude picks a tool, the tool runs, the result goes back to Claude,
and it decides what to do next. It keeps going until the job is done or it
needs you.
:::

:::engineer
Mechanically it's an agent loop over a fixed tool set: read, search, edit
and write files, run shell commands, fetch the web, plus whatever skills and
MCP servers you add. Each tool result is appended to the context and the
model picks the next call, until it ends its turn. The quality of the result
is bounded by what it can read and what it can check.
:::

:::steps{title="One task, the agent's way"}
- "Read" "It looks around: the files you named, your CLAUDE.md, a search for the code that matters."
- "Plan" "It decides what to change. In plan mode it stops here and shows you."
- "Edit" "It changes files, asking first unless you've allowed it."
- "Check" "It runs your tests, types or linter and reads the output."
- "Report" "It tells you what it did, ideally with the command it ran and the result."
:::

---

To install it on macOS, Linux or WSL (checked November 2026):

```sh
curl -fsSL https://claude.ai/install.sh | bash
cd your-project
claude
```

On Windows PowerShell it's `irm https://claude.ai/install.ps1 | iex`. One
honest note: Claude Code needs a paid Claude plan or an API (Console)
account. The free claude.ai plan doesn't include it. This lesson's exercise
runs here for free.

By default Claude Code **asks before** it edits a file, runs a command or
goes online. Press **Shift+Tab** to cycle modes, including **plan mode**,
where it researches and proposes but doesn't touch your code.

---

:::new
The loop is only as good as your brief. "Fix the login bug" makes the agent
guess where to look and when it's done. Give it **where to look**, **what's
wrong** and **how to check it's fixed**: a test it can run that passes or
fails. Anthropic's best-practice guide says it plainly: if Claude said it
was done and wasn't, it usually had no way to check its own work.
:::

:::engineer
Three things decide most outcomes: the search space (named files or a
pattern to follow beat "somewhere in src/"), the success signal (a
reproducing test, a typecheck, a script that diffs output; anything with an
exit code), and evidence (ask for the command it ran and its output rather
than "done"). Anthropic's guide traces "said it was done and wasn't" to a
missing check, and "built something different" to information it couldn't
get from the repo.
:::

Your turn. Moon Café's website shows Sunday as "open" when the café is
closed. The opening-hours logic is in `src/hours.ts`, its tests are in
`tests/hours.test.ts`, and `pnpm test` runs them. Rewrite the vague brief so
an agent could do it right first time, and ask for a plan before any change.
This sandbox Claude can't see a repo, so its reply is the plan it would
follow.

:::prompt{id="first-brief" xp=50 coach}
Rewrite “fix the hours bug” as a brief a coding agent can act on

- goal "Brief an agent with where to look, what's wrong, how to prove it's fixed, and a plan first"
- placeholder "Sunday shows as open … Look at src/… Write a failing test … run pnpm test … Reply with your plan first."
- draft "fix the hours bug"
- check "Says where to look"           /src\/hours|hours\.ts/i
- check "Says what's wrong"            /sunday/i
- check "Says how to check it"         /pnpm test|\btests?\b/i
- check "Asks for a plan first"        /\bplan\b/i
- expect "Replies with a plan"         match /plan|step|\b1\.|first/i
- rubric "Describes the symptom a user sees, not only “a bug”" must on=prompt
- rubric "Gives a pass-or-fail check: a failing test to write, or a command to run" must on=prompt
- rubric "Keeps the job to this one bug" should on=prompt
- rubric "The reply is a plan of steps, not finished code" should
- hint "Could the agent tell when it's finished? Give it something that passes or fails."
- hint "Say what the user sees going wrong, so the test can reproduce it."
- hint "End with “Reply with your plan before changing anything.”"
- reference "On Moon Café's site, Sunday shows as “open”, but the café is closed on Sundays. The logic is in src/hours.ts and the tests are in tests/hours.test.ts. First write a failing test in tests/hours.test.ts that shows Sunday as closed, then fix src/hours.ts so it passes. Run pnpm test and show me the output. Only fix this bug. Reply with your plan before changing anything."
- run temperature=[1.0]
- example T=1.0 "Plan:\n1. Read src/hours.ts to see how the day is checked.\n2. Add a test in tests/hours.test.ts that expects Sunday to be closed, and run pnpm test to watch it fail.\n3. Fix the Sunday case in src/hours.ts.\n4. Run pnpm test again and share the output.\nShall I go ahead?"
- example T=1.0 "Here's my plan. First, reproduce it: a test asserting Sunday is closed, which should fail now. Then find where src/hours.ts maps days to hours and correct Sunday. Finally, run pnpm test and paste the result. I won't touch anything else."
- example T=1.0 "Step 1: write a failing test for Sunday in tests/hours.test.ts. Step 2: fix the day lookup in src/hours.ts. Step 3: run pnpm test and report the output. I'll wait for your go-ahead before editing."
- success "Where to look, what's wrong, how to check, plan first. That's a brief an agent can finish." next="Next: the file it reads every time →"
:::
Try sending the vague draft first. What does Claude have to guess?

:::rabbithole
- read "Best practices for Claude Code" by="Anthropic" url="https://code.claude.com/docs/en/best-practices"
- read "Claude Code 101" by="Claude Academy" url="https://academy.claude.com/courses/claude-code-101"
:::
