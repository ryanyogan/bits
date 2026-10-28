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

:::quiz{id="enum-or-string" xp=20}
Your tool takes a `size` that must be `small`, `medium` or `large`. What's the best way to say so?

- [ ] Make it a string and hope for the best
  Not quite. Claude might send “M” or “Medium”, and your code has to cope.
- [ ] Explain it only in the tool's description
  Not quite. That helps, but the schema can state it exactly.
- [x] A string with an enum of the three values
  Right. An enum lists the only allowed values, so Claude knows exactly what to send.
:::

Your turn. Ask Claude to **write the input schema** for a tool that looks up
a flight's status: a required flight number, and an optional date. Ask for
JSON only, so the answer stays short.

:::prompt{id="write-a-schema" xp=20}
Ask Claude for a JSON Schema for a flight-status tool's input

- placeholder "Write a JSON Schema for … Reply with JSON only."
- draft "Write a schema for a flight tool."
- check "Asks for a JSON Schema"       /json schema|input_schema|input schema/i
- check "Names the inputs"             /flight/i
- check "Names the inputs"             /date/i
- check "Says what's required"         /required|optional/i
- check "Asks for JSON only"           /json only|only (the )?json|just (the )?json|no prose|nothing else/i
- run temperature=[1.0]
- example T=1.0 "{\"type\": \"object\", \"properties\": {\"flight_number\": {\"type\": \"string\", \"description\": \"Airline code and number, e.g. BA117\"}, \"date\": {\"type\": \"string\", \"format\": \"date\", \"description\": \"Departure date, YYYY-MM-DD. Defaults to today.\"}}, \"required\": [\"flight_number\"]}"
- example T=1.0 "{\"type\": \"object\", \"properties\": {\"flight_number\": {\"type\": \"string\"}, \"date\": {\"type\": \"string\", \"description\": \"YYYY-MM-DD\"}}, \"required\": [\"flight_number\"]}"
- success "That's a tool's input, described. Next: what happens when Claude uses it." next="Next: one round trip →"
:::

:::rabbithole
- read "Define tools" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
- read "Getting started with JSON Schema" by="JSON Schema" url="https://json-schema.org/learn/getting-started-step-by-step"
:::
