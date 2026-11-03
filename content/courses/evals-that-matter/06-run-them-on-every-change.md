---
# sources (checked 2026-11-03):
# - Anthropic, Demystifying evals for AI agents: capability evals start at a low pass rate,
#   regression evals sit near 100% to protect against backsliding; balance cases where a behaviour
#   should and shouldn't happen; outputs vary between runs, so run several trials; read transcripts
#   when a task fails to tell a real mistake from a grader rejecting a valid answer; saturation
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Hamel Husain and Shreya Shankar, AI Evals FAQ (2026-09-18): CI sets are small and purpose-built
#   (core features, regression tests for past bugs, known edge cases), favour deterministic checks
#   for cost, run often; retire or run less often an eval that always passes
#   https://hamel.dev/blog/posts/evals-faq/
# - Matt Pocock, AI Hero, Your app is only as good as its evals (updated 2024-11-18): an eval is
#   data (inputs), a task (produces outputs) and scorers (deterministic or LLM); Evalite is his
#   TypeScript eval runner (github.com/mattpocock/evalite, MIT)
#   https://www.aihero.dev/what-are-evals
# Terminal output is an example, not a live run. The shop is made up.
title: "Run them on every change"
order: 6
minutes: 7
xp: 60
module: Keep it working
---

An eval you ran once is a screenshot. An eval that runs **every time the
prompt, the model or the code changes** is a safety net.

The rule that makes it grow: **every bug you fix becomes a test case.** The
Sunday mistake from lesson 2 gets a case the day you fix it, and it stays in
the suite for good. If a later change brings the bug back, the suite says so
before a customer does.

---

:::new
Keep two lists:

- **Regression set**: things the bot already does right. These should pass
  nearly every time. A failure means something broke.
- **Capability set**: things you want it to do but it doesn't yet. Most fail
  today, and that's fine. It's your to-do list, and you watch the pass rate
  climb.

Run the regression set on every change. Keep it small and mostly
code-graded, so it's fast and costs pennies.

When a case fails, **read the reply** before you blame the bot. Sometimes the
bot was wrong. Sometimes the check was too strict and rejected a good answer.
Either way, you've learned something.
:::

:::engineer
Anthropic separates **capability** evals (start at a low pass rate, a hill
to climb) from **regression** evals (should sit near 100%, so a dip means
backsliding). Promote a capability case to the regression set once it passes
reliably.

For CI, the FAQ recommends a small, purpose-built set: core features, a
regression case for every past bug, and the known edge cases. Favour
deterministic checks there because they're cheap. Run LLM judges on a
schedule or a sample.

**Non-determinism.** The same prompt can pass and then fail. Run important
cases several times and gate on a rate (for example 3 of 3, or 9 of 10), not
on one lucky trial.

**Read transcripts on failure.** Anthropic's point: a failure is either a real
mistake or a grader rejecting a valid answer. Both need fixing, in different
places.

**Saturation.** A suite where everything always passes has stopped telling you
anything new. Add harder cases, or run it less often.
:::

Here's the shape of a regression run in CI: run every case, count passes, and
fail the build if anything that used to pass doesn't.

```ts
import { cases } from "./cases"; // [{ name, input, check }]
import { answer } from "./bot";  // your prompt, wrapped in one Claude call

let failed = 0;
for (const c of cases) {
  const ok = c.check(await answer(c.input));
  if (!ok) failed++;
  console.log(ok ? "✓" : "✗", c.name);
}

console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1); // a failure stops the deploy
```

That's the whole idea in a dozen lines: **inputs, a task that produces
replies, and checks that score them**. Matt Pocock's AI Hero guide calls the
same three parts data, task and scorers. When you outgrow a hand-rolled loop,
an eval runner such as his Evalite adds the report, the history and the
LLM scorers for you.

:::terminal{cmd="npx tsx evals/regression.ts" summary="example output, not a live run"}
[volt]✓[quiet] closed on sundays
[volt]✓[quiet] replies in spanish
[ion]✗[quiet] puncture price is £15
[volt]✓[quiet] open on saturdays
3/4 passed
:::

---

One more habit from Anthropic: **test both sides.** When you fix the Sunday
bug, a lazy fix is "say we're closed" to every opening-hours question. A case
that only checks Sunday would pass it. Pair it with a case where the bot
**should not** say closed.

Your turn. Get Claude to write that balanced pair for the Sunday fix.

:::prompt{id="balanced-pair" xp=50 coach}
Get a balanced pair of regression cases for the Sunday fix, as JSON

- goal "Get two cases: one where the reply must say closed on Sunday, and one where it must not say closed, for a day the shop is open"
- placeholder "We fixed a bug: … Write two regression test cases, one where … and one where … Reply with only JSON: {\"cases\": [{\"input\": …, \"expect\": …}]}"
- draft "We fixed a bug: our bike shop's bot said we open on Sundays. We're open Tuesday to Saturday and closed Sundays and Mondays.\n\nWrite regression test cases for this fix."
- check "Includes the opening days"         /sunday/i
- check "Includes the opening days"         /saturday|tuesday/i
- check "Asks for a case where it should not say closed" /should not|shouldn.t|must not|mustn.t|not say|both sides|balanced|open day|opposite/i
- check "Asks for JSON"                     /json/i
- expect "Parses as JSON with a list of cases" json keys=cases types=cases:array
- expect "A case asks about Sunday"          match /sunday/i
- expect "A case asks about a day the shop is open" match /tuesday|wednesday|thursday|friday|saturday/i
- rubric "One case expects the reply to say the shop is closed on Sunday" must
- rubric "The other case asks about a day the shop is open, and expects the reply to say it's open" must
- rubric "Both expectations are specific enough for code or a strict reviewer to check" should
- hint "A fix that says closed to every day would pass a Sunday-only test. What second case would catch that?"
- hint for="The other case asks about a day the shop is open, and expects the reply to say it's open" "Pick a day the shop is open. What must the reply say for that day?"
- reference "We fixed a bug: our bike shop's bot said we open on Sundays. We're open Tuesday to Saturday, 9:00 to 18:00, and closed Sundays and Mondays.\n\nWrite a balanced pair of regression test cases for this fix: one where the reply should say we're closed (a Sunday question), and one where it should not say we're closed (a question about a day we're open). Make each expectation checkable by code.\n\nReply with only JSON: {\"cases\": [{\"input\": \"…\", \"expect\": \"…\"}]}"
- run temperature=[1.0]
- example T=1.0 "{\"cases\": [{\"input\": \"Are you open this Sunday?\", \"expect\": \"Reply says the shop is closed on Sundays\"}, {\"input\": \"Can I drop my bike off on Saturday morning?\", \"expect\": \"Reply says the shop is open on Saturday and does not say it is closed\"}]}"
- example T=1.0 "{\"cases\": [{\"input\": \"Do you open on Sundays?\", \"expect\": \"Contains 'closed' and 'Sunday'\"}, {\"input\": \"What time do you open on Tuesday?\", \"expect\": \"Gives 9:00 and does not contain the word 'closed'\"}]}"
- success "A fix with both sides tested. That pair stays in the suite for good." next="Next: evals for agents →"
:::

:::rabbithole
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/research/demystifying-evals-for-ai-agents"
- read "AI Evals FAQ" by="Hamel Husain and Shreya Shankar" url="https://hamel.dev/blog/posts/evals-faq/"
- read "Your app is only as good as its evals" by="Matt Pocock (AI Hero)" url="https://www.aihero.dev/what-are-evals"
:::
