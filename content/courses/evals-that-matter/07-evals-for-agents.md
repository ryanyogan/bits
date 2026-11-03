---
# sources (checked 2026-11-03):
# - Anthropic, Demystifying evals for AI agents (2026-01-09, updated 2026-10-18): transcript
#   (trace, trajectory) vs outcome (final state); grade what the agent produced rather than the
#   exact path, to avoid rigidity; partial credit for multi-part tasks; isolate each trial in a
#   clean environment; pass@k (at least one of k trials succeeds) vs pass^k (all k succeed)
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Hamel Husain and Shreya Shankar, AI Evals FAQ (2026-09-18): evaluate agents end to end first,
#   then step-level diagnostics; check tool name, arguments, result and resulting state as
#   separate code assertions; transition failure matrices show where workflows break
#   https://hamel.dev/blog/posts/evals-faq/
# The booking agent, its tools and its transcript are made up. pass^k arithmetic assumes
# independent trials.
title: "Evals for agents"
order: 7
minutes: 8
xp: 80
module: Keep it working
---

An agent doesn't give one reply. It takes **steps**: it calls a tool, reads
the result, calls another, then answers. So "did the reply look right?" isn't
enough. An agent can say "You're booked for Friday!" and have booked
Thursday.

Anthropic's guide gives you two things to grade. The **outcome**: what's
actually true at the end, like the booking in the database. The
**transcript**: every step the agent took to get there.

---

:::new
Grade the **outcome first**. Did the right thing happen? Check the booking
that exists, not the agent's message about it.

Don't insist on one exact path. If the agent checks availability twice
before booking, that's fine as long as the result is right. Anthropic warns
that grading the exact sequence of steps makes evals rigid and fails good
agents.

When the outcome is wrong, **read the transcript** to find the **first step
that went wrong**. That's what you fix. Check each tool call on its own: was
it the right tool, with the right inputs, and did the agent use the result
correctly?
:::

:::engineer
Two layers, per the FAQ:

1. **End to end.** Treat the agent as a black box. Define precise success on
   the final state (the database row, the file, the API side effect), not on
   the final message.
2. **Step-level diagnostics.** When it fails, score the trajectory: tool
   choice, argument extraction, error handling, context retention. Assert
   tool name, arguments, result and resulting state separately, in code
   where you can.

Anthropic adds: grade outcomes rather than exact paths (rigid path checks
fail valid strategies), give partial credit on multi-part tasks, and start
each trial from a clean, isolated environment so shared state doesn't make
results flaky. Across many failures, the FAQ's transition failure matrix
(last good state against first failure) shows where workflows tend to break.
:::

:::steps{title="One booking, four steps" illustrative}
- "Ask" "The customer: book my bike in for a service next Friday."
- "Look" "The agent calls check_slots with a date, and gets the free times back."
- "Book" "It calls book with that date and a time. The database now holds a booking."
- "Reply" "It tells the customer what it booked. Check the database, not just this message."
:::

---

There's a second twist: agents vary from run to run. Anthropic uses two
measures:

- **pass@k**: did **at least one** of k tries succeed? Fine when a person
  picks the best attempt.
- **pass^k**: did **all** k tries succeed? This is what a customer feels,
  because every booking has to work.

If one try succeeds 90% of the time, three tries in a row all succeed only
about 73% of the time (0.9 × 0.9 × 0.9).

:::quiz{id="pass-hat-k" xp=20}
Your booking agent succeeds on 90% of single runs. You care that every customer's booking works. Which number should you watch?

- [ ] pass@3: the chance at least one of three runs succeeds
  That's about 99.9% here, and it hides the bookings that fail. Customers don't get three tries.
- [x] pass^3: the chance all three runs succeed
  Right. About 73% here, which is the reliability customers actually feel.
- [ ] The agent's final message saying it booked
  The message can be wrong. Check the booking itself.
:::

---

Your turn. Below is a made-up transcript where the agent told the
customer the right thing and **booked the wrong day**. Write a judge that
grades the outcome, then finds the first step that went wrong.

:::prompt{id="grade-a-trajectory" xp=50 coach}
Grade the agent's transcript: the outcome, then the first bad step

- goal "Get a fail outcome, the number of the first step that went wrong, and a reason that names the wrong date"
- placeholder "You are a strict reviewer of an agent's transcript … First decide the outcome … then the first step that went wrong … Reply with only JSON: {\"outcome\": \"pass\" | \"fail\", \"first_bad_step\": …, \"why\": …}"
- draft "Today is Monday 2 November 2026.\nCustomer: Book my bike in for a service next Friday, please.\n\nStep 1: check_slots(date=\"2026-11-05\") → [\"10:00\", \"14:00\"]\nStep 2: book(date=\"2026-11-05\", time=\"10:00\") → {\"ok\": true}\nStep 3: reply \"You're booked in for Friday at 10:00!\"\n\nDid the agent do this right?"
- check "Includes the transcript"           /2026-11-05/i
- check "Includes the customer's request"   /friday/i
- check "Asks about the outcome"            /outcome|result|end state|final state|booked/i
- check "Asks for the first step that went wrong" /first|which step|step number|where/i
- check "Asks for JSON"                     /json/i
- expect "Parses as JSON with outcome and first_bad_step" json keys=outcome,first_bad_step types=outcome:string,first_bad_step:number
- expect "The outcome is fail"              match /"outcome"\s?:\s?"fail"/i
- expect "The first bad step is step 1"     match /"first_bad_step"\s?:\s?1\b/
- rubric "The reason names the wrong date the agent booked" must evidence
- rubric "The prompt asks for the outcome before the steps" should on=prompt
- hint "Work out the date of next Friday from today's date. Where does the transcript first use a different one?"
- hint for="The first bad step is step 1" "The booking in step 2 is wrong, but did the mistake start there, or one step earlier?"
- hint for="Parses as JSON with outcome and first_bad_step" "Show the exact JSON shape, with first_bad_step as a number, not a string."
- reference "You are a strict reviewer of a booking agent's transcript.\n\nToday is Monday 2 November 2026.\nCustomer: Book my bike in for a service next Friday, please.\n\nStep 1: check_slots(date=\"2026-11-05\") → [\"10:00\", \"14:00\"]\nStep 2: book(date=\"2026-11-05\", time=\"10:00\") → {\"ok\": true}\nStep 3: reply \"You're booked in for Friday at 10:00!\"\n\nFirst grade the outcome: is the booking that now exists the one the customer asked for? Work out the date they meant from today's date. Then find the first step that went wrong.\n\nReply with only JSON: {\"outcome\": \"pass\" | \"fail\", \"first_bad_step\": the step number as a number, or 0 if none, \"why\": \"one sentence\"}"
- run temperature=[1.0]
- example T=1.0 "{\"outcome\": \"fail\", \"first_bad_step\": 1, \"why\": \"Next Friday is 2026-11-06, but the agent checked and booked 2026-11-05, which is a Thursday.\"}"
- example T=1.0 "{\"outcome\": \"fail\", \"first_bad_step\": 1, \"why\": \"The agent used 2026-11-05 (Thursday) from step 1 onward, so the booking is a day early even though the reply says Friday.\"}"
- success "The reply said Friday and the booking said Thursday. Grading the outcome caught it." next="Next: checkpoint →"
:::

:::rabbithole
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/research/demystifying-evals-for-ai-agents"
- read "AI Evals FAQ: evaluating agents" by="Hamel Husain and Shreya Shankar" url="https://hamel.dev/blog/posts/evals-faq/"
:::
