---
# sources (checked 2026-11-03):
# - Anthropic, Define success criteria and build evaluations: specific, measurable criteria;
#   clear rubrics; code grading first, then LLM grading tested for reliability
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Anthropic, Demystifying evals for AI agents: start with 20-50 tasks from real failures;
#   calibrate model graders against people; regression vs capability suites
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Hamel Husain, Using LLM-as-a-Judge for evaluation: binary verdicts with critiques; agreement
#   with a domain expert
#   https://hamel.dev/blog/posts/llm-judge/
# - Hamel Husain and Shreya Shankar, AI Evals FAQ: label 100-200 examples per failure mode to validate a judge
#   https://hamel.dev/blog/posts/evals-faq/
# The meeting notes and the three summaries are made up.
title: "Checkpoint: a judge you can trust"
order: 8
minutes: 8
xp: 80
module: Keep it working
project: true
---

Time to put it together. You'll write a judge, run it on replies a person
has already labelled, and see if it agrees with them on every one. That's
lessons 4 and 5 in one go.

---

:::new
Quick recap of the course, as a checklist you can reuse:

- **Test cases come from real failures**, with expectations you can check.
- **Code grades first.** Ask for output code can read, like JSON.
- **A judge answers one question, pass or fail, with a reason first**, and
  can say "unknown".
- **Check the judge against a person's labels.** Count failures caught and
  good replies passed separately.
- **Run the regression set on every change**, and test both sides of a fix.
- **For agents, grade the outcome first**, then find the first bad step.
:::

:::engineer
The pipeline, end to end:

- **Error analysis** builds the failure taxonomy; each category becomes tasks
  with checkable success criteria and, ideally, a reference solution.
- **Code graders** cover everything objective; constrain output (schemas,
  enums) so they can.
- **LLM judges** cover judgement calls: one criterion each, binary with a
  critique, an escape hatch, and the ground truth in the prompt.
- **Calibration** against a principal expert's labels, with a held-out test
  set, reporting true positive and true negative rates rather than raw
  agreement.
- **Regression gate in CI** (deterministic, a rate across trials), capability
  suite on a schedule, judges sampled.
- **Agents**: outcome on final state, step-level diagnostics on failure,
  pass^k for anything a user relies on.
:::

---

The task: the bike shop uses Claude to summarise its weekly meeting. The
owner wrote one rule for a good summary: **every action item names who
owns it, and it states only decisions the meeting actually made.** Then
they labelled three summaries: **A passes, B fails, C fails.**

Write a judge that applies that rule to all three. Two things grade you:

- **Code** checks your judge agrees with the owner on A, B and C.
- **The coach**, an LLM judge itself, reads your judge's notes and checks
  they name the real problem in B and in C, and that your prompt spells out
  the pass rule.

:::prompt{id="judge-you-can-trust" xp=60 coach}
Write a judge for meeting summaries that agrees with the owner on all three

- goal "Get A pass, B fail and C fail, with notes that name what's wrong in B and in C"
- placeholder "You are a strict reviewer of meeting summaries. A summary passes only if … Notes: … Summary A: … For each, reply with only JSON: {\"notes\": …, \"A\": \"pass\" | \"fail\", \"B\": …, \"C\": …}"
- draft "Meeting notes, 2 Nov: Priya will order the new tyre stock by Friday. Sam will fix the opening hours on the website. We talked about opening on Sundays and decided to wait until spring.\n\nSummary A: Priya orders tyre stock by Friday. Sam fixes the website's opening hours. Sunday opening is on hold until spring.\nSummary B: Tyre stock gets ordered by Friday. Sam fixes the website's opening hours. Sunday opening is on hold until spring.\nSummary C: Priya orders tyre stock by Friday. Sam fixes the website's opening hours. The shop will open on Sundays from next month.\n\nWhich summaries are good?"
- check "Includes the meeting notes"       /decided to wait/i
- check "Includes all three summaries"     /summary a/i
- check "Includes all three summaries"     /summary b/i
- check "Includes all three summaries"     /summary c/i
- check "Asks for pass or fail"            /\bpass\b/i
- check "Asks for pass or fail"            /\bfail/i
- check "Asks for JSON"                    /json/i
- expect "Parses as JSON with A, B, C and notes" json keys=A,B,C,notes types=A:string,B:string,C:string
- expect "Agrees with the owner on A: pass" match /"A"\s?:\s?"pass"/i
- expect "Agrees with the owner on B: fail" match /"B"\s?:\s?"fail"/i
- expect "Agrees with the owner on C: fail" match /"C"\s?:\s?"fail"/i
- rubric "The notes say B doesn't name who orders the tyre stock" must evidence
- rubric "The notes say C claims Sunday opening was decided, when the meeting chose to wait" must evidence
- rubric "The prompt spells out the pass rule: owners on every action item, and only decisions actually made" must on=prompt
- rubric "The prompt asks the judge to say why for each verdict" should on=prompt
- hint "Read your prompt as the judge. Could it tell exactly why B fails, from your rule alone?"
- hint for="Agrees with the owner on B: fail" "B looks almost like A. What does A say about the tyre stock that B doesn't?"
- hint for="Agrees with the owner on C: fail" "Compare C's last sentence with what the meeting decided about Sundays."
- hint for="The prompt spells out the pass rule: owners on every action item, and only decisions actually made" "Write the owner's rule into the prompt, both halves of it, as the test for pass."
- reference "You are a strict reviewer of meeting summaries. A summary passes only if (1) every action item names who owns it, and (2) it states only decisions the meeting actually made. If either is broken, it fails.\n\nMeeting notes, 2 Nov: Priya will order the new tyre stock by Friday. Sam will fix the opening hours on the website. We talked about opening on Sundays and decided to wait until spring.\n\nSummary A: Priya orders tyre stock by Friday. Sam fixes the website's opening hours. Sunday opening is on hold until spring.\nSummary B: Tyre stock gets ordered by Friday. Sam fixes the website's opening hours. Sunday opening is on hold until spring.\nSummary C: Priya orders tyre stock by Friday. Sam fixes the website's opening hours. The shop will open on Sundays from next month.\n\nCheck each summary against both rules, then reply with only JSON, notes first: {\"notes\": \"one sentence per summary saying why\", \"A\": \"pass\" | \"fail\", \"B\": \"pass\" | \"fail\", \"C\": \"pass\" | \"fail\"}"
- run temperature=[1.0]
- example T=1.0 "{\"notes\": \"A names both owners and the Sunday decision correctly. B doesn't say who orders the tyre stock. C says the shop will open on Sundays from next month, but the meeting decided to wait until spring.\", \"A\": \"pass\", \"B\": \"fail\", \"C\": \"fail\"}"
- example T=1.0 "{\"notes\": \"A: correct. B: the tyre order has no owner (it should be Priya). C: invents a decision to open on Sundays next month; the meeting chose to wait.\", \"A\": \"pass\", \"B\": \"fail\", \"C\": \"fail\"}"
- success "Your judge agrees with the owner on all three, for the right reasons. That's the core of every eval suite." next="Back to courses →"
:::

Three labelled replies is a smoke test, not a validated judge. Before you
trust a judge like this in production, label a hundred or more real
summaries, keep some back as a test set, and check how many failures it
catches and how many good summaries it passes. Then put it in your
regression run.

Finish this checkpoint and the course badge is yours.

:::rabbithole
- read "Using LLM-as-a-Judge for evaluation" by="Hamel Husain" url="https://hamel.dev/blog/posts/llm-judge/"
- read "Building with the Claude API: prompt evaluation" by="Anthropic Academy" url="https://academy.claude.com/courses/building-with-the-claude-api" deep
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/research/demystifying-evals-for-ai-agents"
:::
