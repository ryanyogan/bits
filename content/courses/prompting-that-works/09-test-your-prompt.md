---
# sources (checked 2026-10-27):
# - Anthropic, Define success criteria and build evaluations (criteria that are specific and
#   measurable; evals that mirror real inputs, edge cases included: irrelevant or missing
#   input, overly long input, ambiguous cases; automate grading; prefer code-based grading
#   (exact match, string match), then LLM grading with a clear rubric; more cases with
#   automated grading beats fewer hand-graded ones)
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Anthropic, Prompt engineering overview (have success criteria, a way to test them and a
#   first draft before prompt engineering)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
# - Matt Pocock (AI Hero), The Three Types Of Evals (deterministic pass/fail evals, LLM-as-a-judge,
#   human feedback) and Your App Is Only As Good As Its Evals ("evals are unit tests")
#   https://www.aihero.dev/three-types-of-evals
#   https://www.aihero.dev/what-are-evals
# Terminal output is an example, not a live run. The support messages are made up.
title: "Test your prompt"
order: 9
minutes: 8
xp: 60
module: Make it reliable
---

You've written a prompt, run it, and the reply looks great. Is the prompt
done? Not yet. You've seen **one** answer to **one** input. The next input
might be the one that breaks it.

The fix is small and it's the habit that separates people who build with
Claude from people who demo it: **keep a few test cases, and re-run them every
time you change the prompt.** Anthropic calls these **evaluations**, or
**evals**, and puts them before prompt engineering, not after.

---

Start by writing down what “good” means, in a way you can check. “Labels
support messages well” can't be checked. “Replies with exactly one of
`billing`, `bug` or `other`, and gets all ten test messages right” can.

Then pick test cases the way a sceptic would. Include a few **normal** inputs,
and then the awkward ones Anthropic suggests: an **empty or irrelevant**
input, a **very long** one, and an **ambiguous** one where even people might
disagree. Real messages from your users beat anything you invent.

**Let code do the grading when it can.** Anthropic's order of preference is
code first (an exact match, or checking that a phrase is there), then Claude
grading with a clear rubric, and people only when you must. More cases graded
automatically beats a few graded by hand.

You've been using one all course: the checks under each exercise are a tiny
code-graded eval. They're regex patterns run on your prompt, on the server.

---

Here's a whole eval in a few lines. It runs four test messages through a
labelling prompt and counts exact matches.

:::code{file="eval.ts" lang="ts" copy highlight="3-8"}
import { label } from "./label"; // your prompt, wrapped in one Claude call

const cases = [
  { input: "I was charged twice this month", expect: "billing" },
  { input: "The app crashes when I upload a photo", expect: "bug" },
  { input: "", expect: "other" },
  { input: "My card was charged twice and now the app won't open", expect: "billing" },
];

let passed = 0;
for (const { input, expect } of cases) {
  const got = (await label(input)).trim().toLowerCase();
  const ok = got === expect;
  if (ok) passed++;
  console.log(ok ? "✓" : "✗", JSON.stringify(input), "→", got);
}

console.log(`${passed}/${cases.length} passed`);
:::

:::terminal{cmd="npx tsx eval.ts" summary="example output, not a live run"}
[volt]✓[quiet] "I was charged twice this month" → billing
[volt]✓[quiet] "The app crashes when I upload a photo" → bug
[volt]✓[quiet] "" → other
[ion]✗[quiet] "My card was charged twice and now the app won't open" → bug
3/4 passed
:::

The last case is ambiguous: it's a billing problem **and** a bug. The prompt
never said what to do when a message fits two labels, so Claude made a
reasonable call that didn't match yours. That's not Claude being wrong. It's
a gap in the prompt that only a test could find.

**Change one thing at a time**, then re-run every case. A fix for one case can
quietly break another, and you'll only see it if you run them all.

:::quiz{id="grade-it" xp=10}
Your prompt must reply with exactly one label: billing, bug or other. How should you grade it?

- [x] In code: check the reply is exactly the expected label
  Right. It's fast, free and never inconsistent. Save Claude grading for things code can't judge, like tone.
- [ ] Ask Claude to rate each reply from 1 to 10
  Not quite. That's slower and fuzzier than a simple exact-match check, for a question code can answer.
- [ ] Read every reply yourself
  Not quite. Fine for a first look, but it doesn't scale and you won't do it every time you change the prompt.
:::

---

Your turn. Write the labelling prompt and fix the gap: list the **three
labels**, ask for **only the label**, add **a rule for messages that fit two
labels**, and test it on the tricky message from the eval.

:::prompt{id="fix-the-gap" xp=50}
Write the labeller, with a rule for mixed messages, and run the tricky case

- placeholder "Label this support message as billing, bug or other … Reply with only the label. If it fits more than one, …"
- draft "Label this support message: My card was charged twice and now the app won't open."
- check "Lists the labels"                 /billing/i
- check "Lists the labels"                 /\bbug\b/i
- check "Lists the labels"                 /other/i
- check "Asks for only the label"          /\bonly\b|just the label|one word|single word|nothing else/i
- check "Has a rule for mixed messages"    /more than one|both|two labels|fits two|several|multiple|\btie|priorit|comes first|most urgent|money/i
- check "Includes the tricky message"      /charged twice/i
- run temperature=[1.0]
- example T=1.0 "billing"
- example T=1.0 "billing"
- example T=1.0 "billing"
- success "One gap found, one rule added. Now re-run the other cases to check you didn't break them." next="Next: checkpoint →"
:::

:::rabbithole
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
- read "The three types of evals" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/three-types-of-evals"
:::
