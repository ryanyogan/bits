---
# sources (checked 2026-10-27):
# - Anthropic, Strict tool use (strict: true at the top level of a tool definition; grammar-
#   constrained sampling guarantees input matches input_schema and the name is valid; without it
#   Claude might send passengers: "two" or "2" instead of 2; toolsets don't accept it)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
# - Anthropic, Structured outputs (output_config.format with type json_schema for the reply
#   itself; additionalProperties must be false; first use of a schema compiles a grammar, cached
#   24h; limits: 20 strict tools, 24 optional parameters, 16 union-typed parameters per request;
#   enum casing isn't guaranteed; max_tokens or a refusal can still break the shape; supported on
#   Claude Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1 and others)
#   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
title: "Strict schemas"
order: 6
minutes: 7
xp: 60
module: Getting calls right
---

A schema tells Claude what shape you want. By default it's **guidance**, not
a guarantee. Claude follows it very well, but now and then a flight-booking
tool that needs `passengers: 2` gets `"2"` or `"two"`, or a required field goes
missing. One bad call in a thousand is still a crash in production.

Add **`strict: true`** to a tool and the guidance becomes a rule. Claude's
output is limited, token by token, to text that fits your schema, so the
`input` you get always matches it. The technique is called **grammar-
constrained sampling**.

:::code{file="book.ts" lang="ts" copy highlight="6-15" label="strict: true"}
import type Anthropic from "@anthropic-ai/sdk";

export const bookFlight: Anthropic.Tool = {
  name: "book_flight",
  description: "Book seats on a flight. Use it only after the user has confirmed the flight and the number of passengers.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      flight_number: { type: "string", description: "Airline code and number, e.g. TP1351" },
      date: { type: "string", description: "Departure date, YYYY-MM-DD" },
      passengers: { type: "integer", description: "Number of seats, 1 to 9" },
    },
    required: ["flight_number", "date", "passengers"],
    additionalProperties: false,
  },
};
:::

Two things change in the schema. `strict` sits at the top level, next to
`name`. And every object says **`additionalProperties: false`**, meaning “no
fields except the ones listed”. Strict mode needs that.

It isn't free. The first request with a new schema waits a little while the
API compiles it (the result is cached for 24 hours). There are limits per
request: at most 20 strict tools, and 24 optional parameters across all of
them. So save strict mode for the tools where a malformed call would really
hurt.

:::quiz{id="what-strict-does" xp=20}
What does strict: true guarantee?

- [ ] That Claude calls the tool
  Not quite. Whether to call is still Claude's decision (or tool_choice's).
- [x] That the tool's input matches your schema
  Right. Types, required fields and enums all hold, so your code can trust the input's shape.
- [ ] That the input is correct
  Not quite. A valid shape can still hold the wrong city. Strict guards the format, not the facts.
:::

---

Sometimes you don't want a tool call at all. You want **Claude's answer**
as JSON: a list of extracted fields, a label, a summary in a fixed shape.
That's **structured outputs**, and it uses the same machinery. Pass a schema
in `output_config.format` and the reply's text is guaranteed to parse and
match it.

:::code{file="extract.ts" lang="ts" copy}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const reply = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Table for two at Nonna's, Friday 7:30pm" }],
  output_config: {
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          restaurant: { type: "string" },
          day: { type: "string" },
          party_size: { type: "integer" },
        },
        required: ["restaurant", "day", "party_size"],
        additionalProperties: false,
      },
    },
  },
});

const text = reply.content.find((block) => block.type === "text");
if (text) console.log(JSON.parse(text.text)); // { restaurant: "Nonna's", day: "Friday", party_size: 2 }
:::

The rule of thumb: **strict tools** control how Claude calls your code;
**structured outputs** control what Claude says back. You can use both in
one request. And the guarantee has edges: if a reply is cut off by
`max_tokens`, or Claude declines, the JSON can still be incomplete. Check
`stop_reason` before you parse.

:::quiz{id="tool-or-format" xp=20}
You want Claude to read support emails and return { category, urgency } for your dashboard. Nothing needs to run. Which fits?

- [ ] A strict tool called classify_email
  Not quite. It works, but you'd be inventing a tool that never runs just to get JSON.
- [x] Structured outputs with output_config.format
  Right. You want the answer itself in a fixed shape, which is exactly what it's for.
- [ ] Ask nicely for JSON in the prompt
  Not quite. That works most of the time. A dashboard needs every time.
:::

Your turn. Without any of this, you're relying on the prompt. Ask Claude to
turn **“two adults, Friday, Lisbon”** into JSON with `passengers` as a
**number**, plus `day` and `city`. Run it a few times and check the type of
`passengers` each time.

:::prompt{id="json-by-asking" xp=20}
Ask for JSON with a number in it, and check the type

- placeholder "Turn “two adults, Friday, Lisbon” into JSON with passengers (a number), day and city. JSON only."
- draft "Make JSON from: two adults, Friday, Lisbon"
- check "Includes the booking"       /lisbon/i
- check "Names the fields"           /passengers/i
- check "Says passengers is a number" /number|integer|numeric|\bint\b|digit/i
- check "Asks for JSON only"         /json only|only (the )?json|just (the )?json|nothing else|no (other )?text/i
- run temperature=[1.0]
- example T=1.0 "{\"passengers\": 2, \"day\": \"Friday\", \"city\": \"Lisbon\"}"
- example T=1.0 "{\"passengers\": 2, \"day\": \"Friday\", \"city\": \"Lisbon\"}"
- example T=1.0 "{\"passengers\": 2, \"day\": \"Friday\", \"city\": \"Lisbon\"}"
- success "A clear prompt gets this right nearly every time. strict and structured outputs make it every time." next="Next: many calls, some fail →"
:::

:::rabbithole
- read "Strict tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use"
- read "Structured outputs" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/structured-outputs"
:::
