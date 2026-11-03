---
# sources (checked 2026-11-03):
# - Anthropic, Define success criteria and build evaluations: automate grading where possible;
#   code-based grading (exact match, string match) is fastest, most reliable and most scalable but
#   lacks nuance; then LLM grading with a clear rubric; avoid human grading where you can; more
#   automatically graded cases beat fewer hand-graded ones
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Anthropic, Demystifying evals for AI agents: code-based graders are fast, cheap, objective,
#   reproducible and easy to debug, but brittle to valid variations
#   https://www.anthropic.com/research/demystifying-evals-for-ai-agents
# - Hamel Husain and Shreya Shankar, AI Evals FAQ: write a code check when an objective rule can
#   spot the failure (JSON parses, right tool arguments, regex, structure)
#   https://hamel.dev/blog/posts/evals-faq/
# The grader code is a sample to read; nothing in this lesson runs it live except the exercise.
title: "Let code grade first"
order: 3
minutes: 7
xp: 60
module: Grading
---

You have test cases. Now something has to decide pass or fail for each one,
every time, without you reading replies by hand.

Anthropic's order of preference is clear: **code first**. A few lines of code
are fast, free, give the same answer every time, and are easy to debug. Only
reach for a model as the grader when code really can't tell.

---

:::new
Code can check more than you'd think:

- **Exact match.** The reply is exactly `billing`.
- **Contains.** The reply mentions "£15".
- **Format.** The reply is valid JSON with the fields you asked for.
- **Length.** The reply is under 50 words.
- **Pattern.** The reply has a date in it.

The catch: code is literal. If the right answer is "fifteen pounds" and your
check looks for "£15", a correct reply fails. So the trick is to **ask
Claude for output code can check**, like JSON with a fixed set of values.
:::

:::engineer
Code graders cover exact match, substring and regex checks, schema
validation, length limits, and execution tests (does the generated SQL run,
do the tests pass). They're objective and reproducible, so a failing case
means something.

Their weakness is brittleness. Anthropic notes they reject valid variations
that don't match the expected pattern. The fix is to constrain the output so
the valid space is small: an enum of labels, a JSON schema, a fixed date
format. Structured outputs make the schema part a guarantee rather than a
request. The checks below then read fields, not prose.
:::

Here's what a code grader looks like. Each check is a plain function that
takes the reply and returns pass or fail:

```ts
type Check = (reply: string) => boolean;

const isJson: Check = (reply) => {
  try { JSON.parse(reply); return true; } catch { return false; }
};

const hasIntent = (want: string): Check => (reply) =>
  JSON.parse(reply).intent === want;

const underWords = (n: number): Check => (reply) =>
  reply.split(/\s+/).length <= n;
```

Notice `hasIntent` only works because the reply is JSON with an `intent`
field. If the bot answered in a friendly paragraph, you'd need a model to
read it. **Designing the output is half of designing the eval.**

---

Your turn. The bike shop wants to sort incoming messages so bookings,
cancellations and questions go to the right place. Write the prompt so
Claude replies in a shape code can grade, then run it on a cancellation.

This exercise has **no AI coach**. Code grades it, exactly as this lesson
describes: does the reply parse, does it have the fields, and are the values
right.

:::prompt{id="checkable-output" xp=50}
Make Claude reply with JSON code can check: the intent and the day

- goal "Get JSON with an intent of book, cancel or question, and the day, for the cancellation message"
- placeholder "Sort this message. Reply with only JSON: {\"intent\": \"book\" | \"cancel\" | \"question\", \"day\": …} …"
- draft "Sort this customer message for our bike shop: I need to cancel my repair on Friday, sorry!"
- check "Asks for JSON"                      /json/i
- check "Lists the three intents"           /\bbook/i
- check "Lists the three intents"           /cancel/i
- check "Lists the three intents"           /question/i
- check "Asks for the day"                  /\bday\b/i
- check "Includes the cancellation message" /cancel my repair/i
- expect "Parses as JSON with intent and day" json keys=intent,day types=intent:string,day:string
- expect "The intent is cancel"             match /"intent"\s?:\s?"cancel"/i
- expect "The day is Friday"                match /"day"\s?:\s?"friday"/i
- hint "Show Claude the exact JSON shape, with the three intents spelled out as the only allowed values."
- hint "Ask for only the JSON, with nothing before or after it, so code can parse the whole reply."
- reference "Sort this customer message for our bike shop. Reply with only JSON, no other text, in this shape:\n{\"intent\": \"book\" | \"cancel\" | \"question\", \"day\": \"the weekday they mention, or none\"}\n\nMessage: I need to cancel my repair on Friday, sorry!"
- run temperature=[1.0]
- example T=1.0 "{\"intent\": \"cancel\", \"day\": \"Friday\"}"
- example T=1.0 "{\"intent\": \"cancel\", \"day\": \"Friday\"}"
- success "Three checks, all code, no judgement needed. That's the cheapest grader there is." next="Next: when code can't, a judge →"
:::

:::rabbithole
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
- read "AI Evals FAQ" by="Hamel Husain and Shreya Shankar" url="https://hamel.dev/blog/posts/evals-faq/"
:::
