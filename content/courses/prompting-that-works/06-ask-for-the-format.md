---
# sources (checked 2026-10-27):
# - Anthropic, Prompting best practices, "Control the format of responses" (say what to do,
#   not what not to do; XML format indicators; match your prompt's style to the output),
#   "Migrating away from prefilled responses" (prefill on the last assistant turn returns a
#   400 from Claude 4.6 models on; use instructions, tags or structured outputs; strip a stray
#   preamble in post-processing)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
# - Anthropic, Structured outputs (output_config.format with a JSON schema; constrained
#   decoding; TypeScript: zodOutputFormat from @anthropic-ai/sdk/helpers/zod with
#   client.messages.parse and response.parsed_output; supported on claude-haiku-5-5)
#   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# Toy: both outputs are illustrative. Luigi's and the booking are made up.
title: "Ask for the format"
order: 6
minutes: 8
xp: 60
module: Shape the prompt
---

If you don't say what shape you want, Claude picks one. Sometimes that's
headings and bullet points when you wanted a sentence. Sometimes it's a
friendly intro line before the data your code was about to parse.

So say the shape. Anthropic's formatting advice comes down to three habits.

---

**Say what to do, not what not to do.** “Don't use markdown” tells Claude
what to avoid but not what to write instead. “Write it as two short
paragraphs of plain prose” gives it a target.

**Match your prompt to the output.** The style of your prompt rubs off on the
reply. A prompt full of bullet points and bold tends to get bullet points and
bold back. If you want plain prose, write your prompt in plain prose.

**Name a container.** Ask for the answer inside tags, like `<summary>`, or as
JSON with named keys. Then your code knows exactly where the answer starts and
stops.

:::compare{left="No format asked for" right="Format asked for" illustrative}
- prompt "Get the booking details from: Table for 4 at Luigi's, Friday 7:30pm, under the name Okafor."
- left "Sure! Here are the booking details: The reservation is for **4 people** at **Luigi's** on **Friday at 7:30pm**, booked under the name **Okafor**. Let me know if you need anything else!"
- right "{\"name\": \"Okafor\", \"party_size\": 4, \"day\": \"Friday\", \"time\": \"19:30\"}"
:::

The right column's prompt added: “Reply with only JSON, with the keys name,
party_size, day and time.”

---

**When code depends on it, don't just ask. Constrain it.** A prompt makes the
right format very likely; it doesn't make it certain. For JSON your program
will parse, Claude's API has **structured outputs**: you pass a schema, and
the reply is guaranteed to match it. Here's the TypeScript version, with a
Zod schema.

:::code{file="booking.ts" lang="ts" copy highlight="13-16"}
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();
const Booking = z.object({
  name: z.string(),
  party_size: z.number(),
  day: z.string(),
  time: z.string(),
});

const response = await client.messages.parse({
  model: "claude-haiku-5-5",
  max_tokens: 1024,
  output_config: { format: zodOutputFormat(Booking) },
  messages: [{
    role: "user",
    content: "Get the booking details from: Table for 4 at Luigi's, Friday 7:30pm, under the name Okafor.",
  }],
});

console.log(response.parsed_output); // typed as { name, party_size, day, time }
:::

**An old trick you'll still see: prefill.** Older tutorials start Claude's
reply for it, by sending an assistant message that begins with `{`, to force
JSON. Current Claude models (4.6 and later) reject a prefilled last assistant
turn with a 400 error. Use a clear instruction, output tags or structured
outputs instead.

:::quiz{id="no-prefill" xp=20}
A tutorial ends its messages with an assistant turn containing just “{” to force JSON. You run it on Claude Haiku 5.5. What happens?

- [ ] Claude continues the JSON from the “{”
  Not quite. That's how it used to work. Current models don't accept a prefilled last assistant turn.
- [x] The API returns a 400 error
  Right. Prefill was retired from Claude 4.6 models on. Ask for JSON in the prompt, or use structured outputs.
- [ ] Claude ignores it and replies normally
  Not quite. It isn't ignored. The request is refused, so you notice.
:::

---

Your turn. No API here, so do it with the prompt alone. Ask for the booking
as **JSON**, **name the keys** you want (“with the keys name, party_size
and time”), and say it should be **only** the JSON.

:::prompt{id="ask-for-json" xp=40}
Get the booking back as JSON only, with the keys you choose

- placeholder "Reply with only JSON with the keys … Booking: …"
- draft "Get the booking details from: Table for 4 at Luigi's, Friday 7:30pm, under the name Okafor."
- check "Asks for JSON"                   /json/i
- check "Names the keys"                  /\bkeys?\b|fields?|propert/i
- check "Names the keys"                  /party|size|people|guests|covers|count/i
- check "Names the keys"                  /time|\bday\b|date|when/i
- check "Says only the JSON"              /\bonly\b|nothing else|no other text|no preamble|just the json|no explanation/i
- check "Includes the booking"            /okafor/i
- run temperature=[1.0]
- example T=1.0 "{\"name\": \"Okafor\", \"party_size\": 4, \"day\": \"Friday\", \"time\": \"19:30\"}"
- example T=1.0 "{\"name\": \"Okafor\", \"party_size\": 4, \"day\": \"Friday\", \"time\": \"7:30pm\"}"
- example T=1.0 "{\"guest_name\": \"Okafor\", \"people\": 4, \"when\": \"Friday 7:30pm\"}"
- success "You named the shape, and you got it. For code, add a schema and it's guaranteed." next="Next: let it think →"
:::

Run it three times. If the time comes back as “19:30” once and “7:30pm” the
next, that's a hint your prompt should say which format you want. That
sort of drift is what lesson 9's tests are for.

:::rabbithole
- read "Structured outputs" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/structured-outputs"
- read "Prompting best practices: Control the format" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"
:::
