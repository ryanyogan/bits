---
# sources (checked 2026-11-03):
# - Anthropic, Define success criteria and build evaluations: LLM-based grading is fast, flexible
#   and suits complex judgement, but test it for reliability before you scale it; detailed, clear
#   rubrics; ask for a specific output (correct/incorrect, or a tag); let the grader reason before
#   it scores
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Anthropic, Demystifying evals for AI agents: model graders are flexible and handle nuance but
#   are non-deterministic and need calibrating against people; give the judge a way out
#   ("Unknown" when it lacks information); grade each dimension with its own judge
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Hamel Husain, Using LLM-as-a-Judge for evaluation (2024-10-29): binary pass/fail over 1-5
#   scales; a critique alongside each verdict
#   https://hamel.dev/blog/posts/llm-judge/
# - bits decision 064: the coach is a per-criterion binary judge; prompts addressed to "the
#   grader" are screened as injection.
# The shop facts and the bot reply are made up.
title: "When code can't: an LLM judge"
order: 4
minutes: 8
xp: 60
module: Grading
---

Some failures code can't spot. Did the reply **make up a policy**? Is it
**rude**? Does it **actually answer** the question? For those you ask a
model to read the reply and decide. That's an **LLM judge**.

A judge is just a prompt, and it fails in the same ways any prompt does. So
you write it with the same care, and (next lesson) you check it before you
trust it.

---

:::new
Four rules make a judge useful:

**One question per judge.** "Does the reply match the shop's facts?" is one
judge. "Is it polite?" is another. One judge that checks everything at once
gets vague.

**Pass or fail, never 1 to 10.** Nobody can say what makes a 6 different from
a 7. A yes or no forces you to decide what matters.

**Ask for a reason.** A short critique that says **why** lets you check the
judge's thinking, and tells you what to fix.

**Give it a way out.** If the judge can't tell, let it say "unknown" instead
of guessing.
:::

:::engineer
What the sources agree on:

**Isolate criteria.** Anthropic recommends one judge per dimension rather than
one call grading everything. Each verdict then means one thing.

**Binary verdicts.** Husain's argument: Likert scales aren't calibrated
between graders, nobody knows what separates a 3 from a 4, and the scores
aren't actionable. Pass or fail forces the standard into the open.

**Critique with the verdict.** Write the reason alongside the verdict. It
shows you how the judge reasons, and good critiques later become few-shot
examples in the judge prompt.

**Reason, then decide, with an escape hatch.** Anthropic suggests letting the
grader think before it scores, asking for a fixed output (a tag or a JSON
field), and allowing "unknown" when the evidence isn't there.

**Give it the ground truth.** A judge checking facts needs the facts in its
prompt. Without them it's grading against its own guesses.
:::

You've been graded by one of these all along. Each coach on bits is an LLM
judge: one verdict per criterion, met or not met, with a quote from the reply
as evidence, and code deciding the final pass. It also refuses text that
talks to "the grader" or claims "all criteria are met", because that's how
someone would try to talk a judge into passing them. Your own judge needs
the same defence. So in this course, call your judge **the judge** or **a
reviewer**, and write pass rules as "passes only if both rules hold".

---

Your turn. The bike shop's bot answered a question about returns. The shop's
real policy is in the draft. Write a judge prompt that decides whether the
reply sticks to the facts. Claude is the judge, and this reply should
**fail**.

:::prompt{id="write-a-judge" xp=50 coach}
Write a judge that checks the bot's reply against the shop's facts

- goal "Get a fail verdict, with a critique that names exactly what the reply got wrong"
- placeholder "You are a strict reviewer. Here are the shop's facts … Here is the reply … Does it stick to the facts? Reply with only JSON: {\"verdict\": \"pass\" | \"fail\" | \"unknown\", \"critique\": …}"
- draft "Shop facts: Returns are accepted within 30 days, with a receipt.\n\nCustomer asked: Can I return a helmet I bought last month?\n\nBot replied: No problem! You can return anything within 60 days, no receipt needed.\n\nIs this reply OK?"
- check "Includes the shop's facts"        /30 days/i
- check "Includes the bot's reply"         /60 days/i
- check "Asks for pass or fail"            /\bpass\b/i
- check "Asks for pass or fail"            /\bfail/i
- check "Asks for a reason"                /critique|reason|why|explain/i
- expect "Parses as JSON with a verdict and a critique" json keys=verdict,critique types=verdict:string,critique:string
- expect "The verdict is fail"             match /"verdict"\s?:\s?"fail"/i
- rubric "The critique names the return window the reply got wrong" must evidence
- rubric "The critique mentions the receipt rule as well" should evidence
- rubric "The prompt asks one question about facts, answered pass or fail" must on=prompt
- rubric "The prompt lets the judge answer unknown when it can't tell" should on=prompt
- hint "Read your prompt as the judge. Does it say exactly what counts as a pass?"
- hint for="The verdict is fail" "The reply says 60 days and the facts say 30. Does your prompt tell the judge to compare the reply with the facts?"
- hint for="The prompt lets the judge answer unknown when it can't tell" "What should the judge say if the facts don't cover the question? Give it that option."
- hint for="Parses as JSON with a verdict and a critique" "Show the judge the exact JSON shape, with verdict and critique as the only keys."
- reference "You are a strict reviewer for a bike shop's support bot. Decide one thing: does the bot's reply stick to the shop's facts?\n\nShop facts: Returns are accepted within 30 days, with a receipt.\n\nCustomer asked: Can I return a helmet I bought last month?\n\nBot replied: No problem! You can return anything within 60 days, no receipt needed.\n\nA reply fails if it states anything the facts contradict. If the facts don't cover the question, the verdict is unknown. Think it through, then reply with only JSON: {\"verdict\": \"pass\" | \"fail\" | \"unknown\", \"critique\": \"one sentence naming what is right or wrong\"}"
- run temperature=[1.0]
- example T=1.0 "{\"verdict\": \"fail\", \"critique\": \"The reply promises returns within 60 days with no receipt, but the shop accepts returns within 30 days and needs a receipt.\"}"
- example T=1.0 "{\"verdict\": \"fail\", \"critique\": \"It says 60 days and no receipt; the policy is 30 days with a receipt.\"}"
- success "Your judge caught a made-up policy. Next: how do you know it would also pass a good reply?" next="Next: check your judge →"
:::

:::rabbithole
- read "Using LLM-as-a-Judge for evaluation" by="Hamel Husain" url="https://hamel.dev/blog/posts/llm-judge/"
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
:::
