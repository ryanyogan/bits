---
# sources (checked 2026-11-03):
# - Anthropic, Demystifying evals for AI agents (published 2026-01-09, updated 2026-10-18): the
#   vocabulary (task or test case, trial, grader, transcript, outcome, eval suite); outputs vary
#   between runs, so run several trials; capability evals start at a low pass rate, regression
#   evals should sit near 100%
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Anthropic, Define success criteria and build evaluations: success criteria that are specific
#   and measurable; evals that mirror the real task, edge cases included
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Hamel Husain and Shreya Shankar, AI Evals FAQ (2026-09-18): look at your data; generic
#   scores like "helpfulness" create false confidence
#   https://hamel.dev/blog/posts/evals-faq/
# Toy: the compare rows are illustrative, not live runs. The bike shop is made up.
title: "One good reply proves nothing"
order: 1
minutes: 6
xp: 30
module: Why evals
illustrative: true
---

You tweak a prompt. You try it on the message you've been testing with. The
reply is better. You ship it.

A week later a customer sends a message you never tried, and the "better"
prompt gets it wrong. Nothing warned you, because the only test was your
eyes on one reply.

That's the habit this course replaces. An **eval** is a fixed set of test
inputs, each with a way to decide pass or fail, that you run **every time
you change something**. It's a unit test for a prompt.

---

:::new
Here's the trap in one picture. A bike shop's support bot got a prompt
change. Version 2 fixed the message the owner kept testing. It also broke one
nobody tried.
:::

:::engineer
The failure mode is sampling bias plus non-determinism. You evaluate on the
one input you remember, once, and a model's output varies between runs.
Here's a prompt change that wins on the tested input and regresses on an
untested one.
:::

:::compare{left="Version 1" right="Version 2" illustrative}
- prompt "Do you open on Sundays?"
- left "Yes, we're open every day!"
- right "Sorry, we're closed on Sundays and Mondays. We're open Tuesday to Saturday, 9 to 6."
- prompt "¿Arregláis pinchazos?"
- left "Sí, arreglamos pinchazos por 15 libras."
- right "Yes, we fix punctures for £15."
:::

Version 2 fixed Sundays and quietly stopped answering in Spanish. If you'd
kept both messages as test cases and re-run them after the change, you'd
have seen it in seconds.

---

:::new
A few words you'll see all course. They come from Anthropic's guide to
evals:

- A **test case** (or task) is one input plus what a good reply must do.
- A **trial** is one run of it. Claude can answer differently each time, so
  important cases get run more than once.
- A **grader** decides pass or fail. It can be code, another model, or a
  person.
- An **eval suite** is your set of test cases, run together.

The important part is "what a good reply must do". "Be helpful" can't be
checked. "Says we're closed on Sundays" can.
:::

:::engineer
The vocabulary, as Anthropic's agent-evals guide defines it:

- **Task** (test case): defined inputs plus success criteria.
- **Trial**: one attempt. Outputs vary between runs, so you run several and
  report a rate, not a single result.
- **Grader**: logic that scores some aspect of the result: code, a model, or
  a person.
- **Transcript**: the full record of a trial (outputs, tool calls,
  intermediate results). You read these when a case fails.
- **Eval suite**: a set of tasks measuring one capability or behaviour.

Two kinds of suite matter early. **Capability** evals start with a low pass
rate: they're the hill you're climbing. **Regression** evals should pass at
close to 100%: they catch you sliding back.

Avoid generic scores such as "helpfulness: 4.2". Husain and Shankar call
them false confidence. They measure something abstract, not the failures
your users actually hit.
:::

The rest of the course builds this up one piece at a time: where good test
cases come from, how code grades them, when to bring in a model as judge,
how to check that judge, and how to keep it all running.

:::quiz{id="why-evals" xp=20}
Your new prompt gives a great reply to the message you always test with. What should you do before you ship it?

- [ ] Ship it: a great reply means the prompt works
  Not yet. That's one reply to one input, and replies vary between runs.
- [x] Run it on your saved test cases, including ones it used to pass
  Right. A fix for one case can break another, and only re-running them all shows it.
- [ ] Ask Claude to rate its own reply from 1 to 10
  A score on one reply still tells you nothing about the inputs you didn't try.
:::

:::rabbithole
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/research/demystifying-evals-for-ai-agents"
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
:::
