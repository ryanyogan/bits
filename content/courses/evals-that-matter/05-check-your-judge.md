---
# sources (checked 2026-11-03):
# - Shreya Shankar et al., Who Validates the Validators? (arXiv 2404.12272, 2024): LLM evaluators
#   inherit the problems of the LLMs they grade and need human validation; "criteria drift":
#   people need criteria to grade outputs, but grading outputs helps them define the criteria
#   https://arxiv.org/abs/2404.12272
# - Hamel Husain, Using LLM-as-a-Judge for evaluation (2024-10-29): one principal domain expert
#   sets the standard; iterate the judge prompt until agreement is high (e.g. over 90%); raw
#   agreement misleads when classes are imbalanced, so report true positive and true negative
#   rates separately
#   https://hamel.dev/blog/posts/llm-judge/
# - Hamel Husain and Shreya Shankar, AI Evals FAQ (2026-09-18): label 100-200 examples per failure mode; split
#   about 10-20% train (examples in the prompt), 40-45% dev (while refining), 40-45% test (once)
#   https://hamel.dev/blog/posts/evals-faq/
# - Anthropic, Demystifying evals for AI agents: calibrate model graders closely with human experts
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# Toy: the 20-reply example is illustrative. The shop and its replies are made up.
title: "Check your judge against a person"
order: 5
minutes: 8
xp: 70
module: Grading
---

Your judge failed the bad reply. Good. Would it also **pass a good one**? Or
does it fail everything, which would look identical on that single test?

An LLM judge is a prompt, so it has the same problems as the prompt it's
grading. Shankar and colleagues put it bluntly: model graders inherit the
flaws of the models they grade, so a person has to check them. You check a
judge the way you check anything else: against answers you already know.

---

:::new
The answers you already know come from **a person who knows what good
looks like**: the shop owner, a support lead, you. They label real replies
pass or fail, each with a reason. Then you run your judge on the same
replies and count how often it agrees.

There's a surprise waiting. Shankar's research found that people **change
their minds about the rules while labelling**. You don't fully know what
"good" means until you've looked at real replies. So label first, then write
the judge's rules from what you learned.
:::

:::engineer
The calibration loop:

1. **One principal expert labels.** Husain recommends one person (two at
   most) whose judgement defines the standard. Binary label plus a critique.
2. **Label enough to measure.** The FAQ suggests 100 to 200 examples for
   each failure mode, split
   about 10–20% as few-shot examples in the judge prompt, 40–45% as a dev set
   you iterate against, and 40–45% held out for one final test.
3. **Iterate the judge prompt** against the dev set until agreement is high.
   Husain uses over 90% as a working bar.
4. **Test once** on the held-out set, so you're not fooling yourself with a
   prompt tuned to the examples it's graded on.

Expect **criteria drift** (Shankar et al.): grading outputs changes the
criteria. Some criteria only appear once you've seen specific outputs, so
writing the rubric before looking at any outputs doesn't work well.
:::

::::engineer
:::steps{title="Calibrating a judge" illustrative}
- "Label" "A person marks real replies pass or fail, each with a reason."
- "Write" "Turn their reasons into the judge's rules, plus a few labelled examples."
- "Run" "The judge grades the dev set: replies it hasn't seen as examples."
- "Compare" "Count agreement, and separately: failures caught, good replies passed."
- "Fix" "Read every disagreement. Fix the judge's prompt, or the label."
:::
::::

---

Watch out for one trap. Say a person labelled 20 replies: 18 good, 2 bad.
Your judge says "pass" to all 20. That's **18 out of 20, 90% agreement**,
and the judge is useless: it missed both failures.

So count two things separately:

- **Failures caught.** Of the replies the person failed, how many did the
  judge fail?
- **Good replies passed.** Of the replies the person passed, how many did the
  judge pass?

A judge that never says "fail" scores perfectly on the second and zero on the
first. Husain calls these the true positive and true negative rates, and
reports them separately because overall agreement hides this.

---

Your turn: a tiny calibration run. The shop owner labelled two bot replies:
**A passes, B fails.** Write a judge prompt that grades both, and see if it
agrees with the owner on both.

There's **no AI coach** here, on purpose. Agreement with a person's labels is
arithmetic, so code checks it: your judge must say pass for A and fail for B.

:::prompt{id="agree-with-a-person" xp=50}
Write a judge that grades two replies, and agrees with the owner on both

- goal "Get JSON with A as pass and B as fail, matching the owner's labels, with a note on why"
- placeholder "You are a strict reviewer. Shop facts: … Reply A: … Reply B: … For each, does it stick to the facts? Reply with only JSON: {\"A\": \"pass\" | \"fail\", \"B\": …, \"notes\": …}"
- draft "Shop facts: A puncture repair costs £15. We're open Tuesday to Saturday, 9:00 to 18:00.\n\nCustomer asked: How much to fix a flat, and can I come Saturday?\n\nReply A: A puncture repair is £15, and yes, we're open Saturday from 9 to 6.\nReply B: Fixing a flat costs £10, and we're open Saturday until 8pm.\n\nAre these OK?"
- check "Includes the shop's facts"   /£15|15 pounds/i
- check "Includes both replies"       /reply a/i
- check "Includes both replies"       /reply b/i
- check "Asks for pass or fail"       /\bpass\b/i
- check "Asks for pass or fail"       /\bfail/i
- check "Asks for JSON"               /json/i
- expect "Parses as JSON with A, B and notes" json keys=A,B,notes types=A:string,B:string
- expect "Agrees with the owner on A: pass" match /"A"\s?:\s?"pass"/i
- expect "Agrees with the owner on B: fail" match /"B"\s?:\s?"fail"/i
- hint "Tell the judge what makes a reply fail: anything the facts contradict."
- hint "Show the exact JSON shape: A and B each hold only the word pass or fail, and notes holds the reasons."
- reference "You are a strict reviewer for a bike shop's support bot. For each reply, decide one thing: does it stick to the shop's facts? A reply fails if it states anything the facts contradict.\n\nShop facts: A puncture repair costs £15. We're open Tuesday to Saturday, 9:00 to 18:00.\n\nCustomer asked: How much to fix a flat, and can I come Saturday?\n\nReply A: A puncture repair is £15, and yes, we're open Saturday from 9 to 6.\nReply B: Fixing a flat costs £10, and we're open Saturday until 8pm.\n\nReply with only JSON: {\"A\": \"pass\" | \"fail\", \"B\": \"pass\" | \"fail\", \"notes\": \"one sentence per reply saying why\"}"
- run temperature=[1.0]
- example T=1.0 "{\"A\": \"pass\", \"B\": \"fail\", \"notes\": \"A matches the price and hours. B says £10 instead of £15 and claims Saturday hours until 8pm, but the shop closes at 18:00.\"}"
- example T=1.0 "{\"A\": \"pass\", \"B\": \"fail\", \"notes\": \"A is correct on both facts. B gets the price and the closing time wrong.\"}"
- success "Two for two with the owner. A real judge needs a hundred or more labelled replies, but the check is exactly this one." next="Next: run them on every change →"
:::

:::rabbithole
- read "Who validates the validators?" by="Shreya Shankar et al." url="https://arxiv.org/abs/2404.12272" deep
- read "Using LLM-as-a-Judge for evaluation" by="Hamel Husain" url="https://hamel.dev/blog/posts/llm-judge/"
:::
