---
# sources (checked 2026-11-03):
# - Claude Academy, Claude Code 101 (Explore → Plan → Code → Commit; /compact, /clear, /context)
#   https://academy.claude.com/courses/claude-code-101
# - Claude Code docs, Choose a permission mode (plan mode: reads and explores, edits blocked until
#   you approve the plan; Shift+Tab, /plan, claude --permission-mode plan)
#   https://code.claude.com/docs/en/permission-modes
# - Claude Code docs, Best practices (something that comes back pass or fail; ask for the command
#   and its output; /clear between unrelated tasks; a reviewer that didn't write the code)
#   https://code.claude.com/docs/en/best-practices
# - AI Hero (Matt Pocock), feedback loops and TDD with agents (ideas credited, words our own)
#   https://www.aihero.dev/skills-tdd
# Toy: the compared outcomes are illustrative. Moon Café's repo is made up.
title: "Plan, build, review"
order: 3
minutes: 8
xp: 60
module: The agent and you
---

The biggest mistakes with coding agents happen before any code is written:
the agent heads off in the wrong direction and you find out 400 lines
later. The fix is a rhythm Anthropic teaches in Claude Code 101: **explore,
plan, code, commit**.

:::new
1. **Explore.** Let it read the relevant files first, without changing
   anything.
2. **Plan.** It proposes the change in steps. You read the plan and correct
   it. This is the cheapest moment to catch a bad idea.
3. **Code.** It makes the change, small enough that you can review it.
4. **Commit.** Once the checks pass, save it with a clear message.

Plan mode does steps 1 and 2 for you: press **Shift+Tab** until you see it,
or start a single prompt with `/plan`. Claude reads and proposes, and can't
edit anything until you approve.
:::

:::engineer
Explore → plan → code → commit maps onto permission modes. Plan mode
(`Shift+Tab`, `/plan` for one prompt, or `claude --permission-mode plan`)
lets Claude read files and run exploratory commands but blocks edits until
you approve the plan. Review the plan as you would a design doc: the files
it'll touch, the approach, what it'll test. Redirecting a plan costs one
message; redirecting a 400-line diff costs the diff.
:::

---

:::new
**Keep each change small.** One feature or one fix per task. A small diff
is one you'll actually read; a giant one you'll wave through. Between
unrelated tasks, run `/clear` so old context doesn't leak into the new job.

**Tests are the agent's eyes.** An agent can't look at your app the way you
do. A test, a typecheck or a linter gives it a yes or no it can see. Ask it
to run the check and **show you the output**, not just say "done". Matt
Pocock goes further: have the agent write the failing test first, so the
fix has a target.
:::

:::engineer
**Scope.** One concern per task keeps diffs reviewable and makes failures
attributable; `/clear` between tasks stops stale context steering the next
one, and `/compact` with a focus keeps a long session on track.

**Feedback loops.** Give the agent an oracle with an exit code: a
reproducing test (test-first, as Matt Pocock teaches), `tsc --noEmit`, a
linter, a fixture diff. Demand evidence: the command and its output. For a
second opinion, ask a reviewer that didn't write the code (Claude Code's
`/code-review`, or a subagent, lesson 6).
:::

:::compare{left="Build it all" right="Plan, then small steps" illustrative}
- prompt "Add a “closed today” banner to Moon Café's homepage"
- left "Done! I've added the banner, refactored the hours module, renamed three helpers for consistency and updated the styles across the site. All looks good."
- right "Plan: 1) add isClosedToday() to src/hours.ts with a test, 2) show the banner in src/pages/home.tsx when it's true. Nothing else changes. After step 2: pnpm test → 14 passed. Ready to commit?"
:::

The left reply sounds productive, but you now have a sprawling diff and no
proof. The right one did less, told you what it touched, and showed the
test run.

---

Your turn. Brief an agent to add that "closed today" banner. Put the
homepage in `src/pages/home.tsx` and the hours logic in `src/hours.ts`. Your
brief should keep the scope tight (say what not to touch), name the check
(`pnpm test`), ask for the test output as proof, and ask for the plan
first.

:::prompt{id="small-and-proven" xp=60 coach}
Brief a small, provable change: scope, check, proof, plan first

- goal "Get a plan for one small change that names its files, stays in scope and ends with proof"
- placeholder "Add a “closed today” banner … in src/pages/home.tsx … Don't change … Run pnpm test and show me … Plan first."
- draft "Add a closed today banner to the homepage."
- check "Names the files"           /home\.tsx|src\/pages|hours\.ts/i
- check "Names the check"           /pnpm test|\btests?\b/i
- check "Asks for proof"            /output|show|paste|result/i
- check "Asks for a plan first"     /\bplan\b/i
- check "Limits the scope"          /\bonly\b|don.t|do not|nothing else|no other|leave/i
- expect "Replies with a plan"      match /plan|step|\b1\.|first/i
- rubric "Says what's out of scope, so the agent doesn't refactor around it" must on=prompt
- rubric "Asks to see the check's output, not just “done”" must on=prompt
- rubric "The plan stays within the files the brief names" should
- hint "What should the agent leave alone? Say so, or it may tidy up half the site."
- hint "“Done” isn't proof. Ask for the command it ran and what it printed."
- reference "Add a “closed today” banner to Moon Café's homepage. Add an isClosedToday() helper with a test in src/hours.ts, and show the banner in src/pages/home.tsx when it's true. Don't change anything else: no renames or refactors. Run pnpm test and paste the output when you're done. Reply with your plan before editing."
- run temperature=[1.0]
- example T=1.0 "Plan:\n1. Add isClosedToday() to src/hours.ts, with a test.\n2. Render the banner in src/pages/home.tsx when it returns true.\n3. Run pnpm test and paste the output.\nI won't touch any other files. OK to start?"
- example T=1.0 "Here's the plan: first a failing test for isClosedToday() in the hours tests, then the helper in src/hours.ts, then the banner in src/pages/home.tsx. I'll leave everything else alone and finish by running pnpm test and showing you the result."
- example T=1.0 "Step 1: write isClosedToday() in src/hours.ts and test it. Step 2: add the banner to src/pages/home.tsx. Step 3: run pnpm test and share the output. No other changes."
- success "Small, scoped and proven. That diff is one you'll actually review." next="Next: teach it a skill →"
:::
:::rabbithole
- read "Choose a permission mode" by="Anthropic" url="https://code.claude.com/docs/en/permission-modes"
- read "Claude Code in action" by="Claude Academy" url="https://academy.claude.com/courses/claude-code-in-action"
- read "TDD with coding agents" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/skills-tdd"
:::
