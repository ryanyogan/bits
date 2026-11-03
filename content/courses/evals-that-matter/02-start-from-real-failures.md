---
# sources (checked 2026-11-03):
# - Hamel Husain and Shreya Shankar, AI Evals FAQ (2026-09-18): error analysis decides which evals
#   to write; open coding (read traces, note the first failure), axial coding (group notes into a
#   failure taxonomy and count); annotate at least 30 traces yourself, keep reviewing until new
#   traces stop showing new failures (theoretical saturation, ~100 as a guardrail)
#   https://hamel.dev/blog/posts/evals-faq/
# - Anthropic, Demystifying evals for AI agents: start with 20-50 simple tasks drawn from real
#   failures (manual checks, common user tasks, bug trackers, support queues); write a reference
#   solution per task; balance cases where a behaviour should and shouldn't happen
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# The bike shop, its facts and its failures are made up.
title: "Start from real failures"
order: 2
minutes: 7
xp: 70
module: Why evals
---

Where do good test cases come from? Not from brainstorming in an empty file.
They come from **things that actually went wrong**.

Anthropic's advice for a first eval suite is 20 to 50 simple tasks drawn from
real failures: the checks you already do by hand, what users commonly ask,
your bug tracker and your support inbox. You don't need hundreds to start.

---

:::new
The habit has a name, **error analysis**, and it's mostly reading.

1. Collect real conversations your bot had (or, before launch, realistic ones).
2. Read them yourself. For each, write a short note about **the first thing
   that went wrong**.
3. Group the notes into kinds of failure and count them.
4. Fix the biggest group first, and turn each kind of failure into test cases.

Husain and Shankar suggest reading at least 30 conversations yourself before
asking any tool to help, and to keep going until new ones stop showing you
new kinds of failure.
:::

:::engineer
The method is borrowed from qualitative research. Husain and Shankar call it
the most important activity in evals, because it decides which evals you
write.

1. **Dataset.** Representative traces of real use, or realistic synthetic ones
   before launch.
2. **Open coding.** Read traces and write free-text notes, focusing on the
   first failure in each. Do at least 30 yourself.
3. **Axial coding.** Group the notes into a failure taxonomy and count each
   category.
4. **Iterate until saturation.** Keep sampling until new traces stop adding
   or changing categories. A pool of about 100 diverse traces is their
   guardrail. An agent can help find more examples of a failure you've
   already named, but don't let it name your failures for you.

Then turn categories into tasks. Each task needs an input, success criteria
you can check, and ideally a reference solution: a known good output that
passes, which proves the task is solvable and the grader works.
:::

---

A test case is only as good as its "expect". Compare:

- "Replies helpfully about opening hours." Nobody can grade that the same way twice.
- "Says the shop is **closed on Sundays**." Code can check it.

One more rule from Anthropic: test both sides. If the bot should say
"closed" on Sunday, also test that it **doesn't** say "closed" on Saturday.
A suite with only one side rewards a bot that says "closed" to everyone.

Your turn. The shop owner read last week's chats and wrote three notes. Get
Claude to turn them into test cases you could run.

:::prompt{id="failures-to-cases" xp=50 coach}
Turn the owner's three failure notes into test cases, as JSON

- goal "Get one test case per failure, each with a real customer message and an expectation specific enough to check"
- placeholder "Turn each failure below into a test case. Reply with only JSON: {\"cases\": [{\"input\": …, \"expect\": …}]} …"
- draft "Here are three failures from our bike shop's support bot:\n1. A customer asked if we open on Sunday. The bot said yes. We're closed Sundays and Mondays.\n2. A customer wrote in Spanish. The bot replied in English.\n3. A customer asked what a puncture repair costs. The bot said £10. It's £15.\n\nMake test cases from these."
- check "Includes the three failures"   /sunday/i
- check "Includes the three failures"   /spanish/i
- check "Includes the three failures"   /puncture/i
- check "Asks for JSON"                 /json/i
- check "Asks for an input and an expectation per case" /\binput\b|message/i
- check "Asks for an input and an expectation per case" /expect|should|must|pass/i
- expect "Parses as JSON with a list of cases" json keys=cases types=cases:array
- expect "A case expects the price £15"     match /£15|15 pounds|15 GBP/i
- expect "A case expects the shop to be closed on Sundays" match /closed|not open|isn.t open|doesn.t open/i
- rubric "There is one test case for each of the three failures: Sunday hours, the Spanish reply and the puncture price" must
- rubric "Each expectation is specific enough to check, like a fact, a language or a price, not 'is helpful'" must
- hint "Read each expectation and ask: could two people grade this the same way without arguing?"
- hint for="Parses as JSON with a list of cases" "Show Claude the exact shape you want, with a key called cases holding a list."
- hint for="A case expects the price £15" "An expectation can quote the right answer. What should the reply say a puncture repair costs?"
- hint for="A case expects the shop to be closed on Sundays" "An expectation can say exactly what the reply must state. What's true about Sundays?"
- reference "Here are three failures from our bike shop's support bot:\n1. A customer asked if we open on Sunday. The bot said yes. We're closed Sundays and Mondays.\n2. A customer wrote in Spanish. The bot replied in English.\n3. A customer asked what a puncture repair costs. The bot said £10. It's £15.\n\nTurn each failure into one test case. Write the input as a realistic customer message. Write the expectation as something a script or a strict reviewer could check: a fact, a price or a language, never \"is helpful\".\n\nReply with only JSON in this shape: {\"cases\": [{\"input\": \"…\", \"expect\": \"…\"}]}"
- run temperature=[1.0]
- example T=1.0 "{\"cases\": [{\"input\": \"Are you open on Sunday?\", \"expect\": \"Says the shop is closed on Sundays (and Mondays)\"}, {\"input\": \"Hola, ¿a qué hora abrís el sábado?\", \"expect\": \"Replies in Spanish\"}, {\"input\": \"How much is a puncture repair?\", \"expect\": \"States the price £15\"}]}"
- example T=1.0 "{\"cases\": [{\"input\": \"Can I bring my bike in this Sunday?\", \"expect\": \"Reply says the shop is closed on Sundays and Mondays\"}, {\"input\": \"¿Cuánto cuesta arreglar un pinchazo?\", \"expect\": \"Reply is written in Spanish\"}, {\"input\": \"What do you charge to fix a puncture?\", \"expect\": \"Reply gives £15 as the price\"}]}"
- success "Three failures, three test cases you can re-run forever." next="Next: let code grade first →"
:::

:::rabbithole
- read "AI Evals FAQ: error analysis" by="Hamel Husain and Shreya Shankar" url="https://hamel.dev/blog/posts/evals-faq/"
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/research/demystifying-evals-for-ai-agents"
:::
