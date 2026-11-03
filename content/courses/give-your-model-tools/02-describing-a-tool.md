---
# sources (checked 2026-10-27):
# - Anthropic, Define tools (a tool is name + description + input_schema; name must match
#   ^[a-zA-Z0-9_-]{1,128}$; input_schema is a JSON Schema object; use enum for fixed values;
#   mark only truly required parameters in required; descriptions are the most important factor)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic, Tool use with Claude, Pricing (tool definitions are input tokens; the tool-use
#   system prompt adds 286 tokens on Claude Haiku 5.5 with tool_choice auto or none)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - JSON Schema (the schema language input_schema uses)
#   https://json-schema.org/
title: "Describing a tool"
order: 2
minutes: 7
xp: 60
module: Why tools
---

Claude never sees your function's code. It only sees a **description** of
it, and that description has three parts.

**`name`** is what Claude calls it by, like `get_weather`. Letters, digits,
underscores and dashes, up to 128 characters. **`description`** is plain
English: what the tool does and when to use it. **`input_schema`** says what
arguments it takes, written in **JSON Schema**, a standard way to describe
the shape of a JSON object.

:::code{file="tools.ts" lang="ts" copy highlight="5-24" label="one tool, described"}
import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather for one city. Use it whenever the user asks " +
      "about weather, temperature or what to wear outdoors right now. " +
      "It returns current conditions only, not forecasts.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City name, with country if it's ambiguous, e.g. Paris, France",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit. Defaults to celsius.",
        },
      },
      required: ["city"],
    },
  },
];
:::

Read the schema from the top. The input is an **object**. It has two
**properties**: `city`, a string, and `unit`, which can only be `"celsius"`
or `"fahrenheit"` because it has an **`enum`**. Only `city` is
**required**, so Claude can leave `unit` out.

Each property gets its own description too. “City name, with country if
it's ambiguous” is what stops Claude sending `"Paris"` when the user meant
Paris, Texas.

:::quiz{id="what-claude-reads" xp=20}
Claude has to decide whether a question needs `get_weather`. What does it go on?

- [ ] The code inside your weather function
  Not quite. Claude never sees your code, only the definition you send.
- [x] The tool's name, description and schema
  Right. That's all it has, which is why the description matters so much.
- [ ] It tries the tool and sees what happens
  Not quite. Claude can't run anything. It can only ask your code to.
:::

---

You send the list of tools with **every request**, in a `tools` field next to
your messages. That has a cost: the definitions are input tokens, and
turning tools on adds a small hidden system prompt that teaches Claude how to
call them (286 tokens on Claude Haiku 5.5, as of October 2026). A handful of
tools is cheap. Hundreds of them crowd the context, which is one reason to
keep your list short.

Your turn. Ask Claude to **write the input schema** for a tool that looks up
a flight's status: a required flight number, an optional date, and a
`leg` that can only be departure, arrival or both. Ask for JSON only, so the
answer stays short.

:::prompt{id="write-a-schema" xp=30 coach}
Ask Claude for a JSON Schema for a flight-status tool's input
- goal "Get a JSON Schema for a flight-status tool: a required flight number, an optional date, and a leg that can only be departure, arrival or both"
- placeholder "Write a JSON Schema for … Reply with JSON only."
- draft "Write a schema for a flight tool."
- check "Asks for a JSON Schema" /json schema|input_schema|input schema/i
- check "Names the inputs" /flight/i
- check "Names the inputs" /date/i
- expect "Is valid JSON" json keys=type,properties
- expect "Limits the fixed choice with an enum" match /"enum"/
- expect "Says what's required" match /"required"/
- rubric "Only the flight number is required" must
- rubric "The leg is an enum of exactly departure, arrival and both" must evidence
- rubric "Each property has a type and a description with an example or format" should
- hint "Claude can only build the inputs you name. Does your prompt list all three, and say which ones are required?"
- hint "A value from a fixed set shouldn't be a free string. How does a schema list the only allowed values?"
- hint "Name each input, say which is required, list the allowed values for leg, and ask for the JSON only."
- reference "Write the JSON Schema for a flight-status tool's input. It takes:\n- flight_number (required): airline code and number, like BA117\n- date (optional): departure date as YYYY-MM-DD, defaulting to today\n- leg (optional): one of departure, arrival or both\n\nGive every property a type and a description, and use an enum for leg. Reply with the JSON only."
- run temperature=[1.0]
- example T=1.0 "{\"type\": \"object\", \"properties\": {\"flight_number\": {\"type\": \"string\", \"description\": \"Airline code and number, e.g. BA117\"}, \"date\": {\"type\": \"string\", \"format\": \"date\", \"description\": \"Departure date, YYYY-MM-DD. Defaults to today.\"}, \"leg\": {\"type\": \"string\", \"enum\": [\"departure\", \"arrival\", \"both\"], \"description\": \"Which times to return. Defaults to both.\"}}, \"required\": [\"flight_number\"]}"
- example T=1.0 "{\"type\": \"object\", \"properties\": {\"flight_number\": {\"type\": \"string\"}, \"date\": {\"type\": \"string\", \"description\": \"YYYY-MM-DD\"}, \"leg\": {\"type\": \"string\", \"enum\": [\"departure\", \"arrival\", \"both\"]}}, \"required\": [\"flight_number\"]}"
- success "That's a tool's input, described exactly. Next: what happens when Claude uses it." next="Next: one round trip →"
:::

:::rabbithole
- read "Define tools" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
- read "Getting started with JSON Schema" by="JSON Schema" url="https://json-schema.org/learn/getting-started-step-by-step"
:::
