---
# sources (checked 2026-10-27):
# - Anthropic, Tool use with Claude ("How tool use works": stop_reason "tool_use", a tool_use
#   block, your code runs it, a second request sends a tool_result; TypeScript round-trip example)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Anthropic, Handle tool calls (tool_use has id, name, input; reply with a user message whose
#   content starts with tool_result blocks carrying tool_use_id; results must immediately follow
#   the tool_use turn)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - Anthropic SDK for TypeScript 1.3.0 types (Anthropic.Tool, Anthropic.ToolUseBlock,
#   Anthropic.MessageParam), checked by compiling the lesson code
# Terminal block: example output written for this lesson, not a recorded run.
title: "One round trip"
order: 3
minutes: 8
xp: 40
module: Why tools
---

Here's what happens when Claude uses a tool, from your code's point of view.
It takes **two requests**.

**Request one.** You send the question and the tools. Claude decides it needs
the weather, so instead of an answer it sends back a reply with
`stop_reason: "tool_use"` and a **`tool_use` block**: an `id`, the tool's
`name`, and the `input` it wants to pass.

**Your code runs the tool.** Claude has only asked. Nothing has been
fetched yet.

**Request two.** You send the conversation back with two more turns: Claude's
reply exactly as it came, then a user turn holding a **`tool_result` block**
with the same `tool_use_id` and your result. Now Claude writes the answer.

:::code{file="weather.ts" lang="ts" copy highlight="14-48" label="the round trip"}
import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./tools";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

// A stand-in for a real weather API (the checkpoint uses a real one).
function getWeather(city: string) {
  return { city, temp_c: 5, sky: "overcast" };
}

const question = process.argv[2] ?? "Do I need a coat in Chicago?";
const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];

// Request one: question + tools.
const first = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 4096,
  tools,
  messages,
});

const call = first.content.find((block) => block.type === "tool_use");
if (first.stop_reason !== "tool_use" || !call) {
  // Claude answered without a tool. That's allowed.
  for (const block of first.content) if (block.type === "text") console.log(block.text);
  process.exit(0);
}

// Your code runs the tool. Claude only asked.
const { city } = call.input as { city: string };
const result = getWeather(city);

// Request two: Claude's reply as it came, then the result.
messages.push(
  { role: "assistant", content: first.content },
  {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) }],
  },
);
const second = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 4096,
  tools,
  messages,
});

for (const block of second.content) if (block.type === "text") console.log(block.text);
:::

:::code{file="tools.ts" lang="ts" copy}
import type Anthropic from "@anthropic-ai/sdk";

// The tool from the last lesson, shortened.
export const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather for one city. Use it whenever the user asks " +
      "about weather, temperature or what to wear outdoors right now.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Paris, France" },
      },
      required: ["city"],
    },
  },
];
:::

:::terminal{cmd='npx tsx weather.ts "Do I need a coat in Chicago?"'}
[muted]example output, written for this lesson (not a live run)
[ion]→ request 1[quiet]  stop_reason=[volt]"tool_use"
[quiet]  { type: "tool_use", id: "toolu_01A0…", name: "get_weather", input: { city: "Chicago" } }
[volt]← your code[quiet]  getWeather("Chicago") → { temp_c: 5, sky: "overcast" }
[ion]→ request 2[quiet]  stop_reason=[volt]"end_turn"
Yes. It's 5°C and overcast in Chicago, so bring a coat.
:::

Notice what the second request carries: the whole conversation, again. The
API doesn't remember the first request, so you send the question, Claude's
tool call and your result together.

---

Three rules keep the API happy. Break one and the request fails with an
error.

**Send Claude's reply back unchanged.** Push `first.content` as it came, not
just the `tool_use` block. The reply can hold other blocks, like a sentence
of text before the call, and they belong in the history.

**Answer every call, straight away.** The very next message after a
`tool_use` must be a user message with its `tool_result`. Nothing can sit in
between.

**Results go first.** If you add your own text to that user message, it goes
after the `tool_result` blocks, never before.

:::quiz{id="matching-id" xp=20}
How does Claude know which call your result answers?

- [ ] Results are matched by the order they arrive in
  Not quite. Order isn't what links them.
- [x] The tool_result's tool_use_id matches the tool_use block's id
  Right. Every call has an id, and your result quotes it back.
- [ ] The tool_result repeats the tool's name
  Not quite. A tool_result has no name field. The id does the matching.
:::

:::quiz{id="skip-the-reply" xp=20}
You send request two with the tool_result but forget to push Claude's reply (`first.content`) first. What happens?

- [ ] Claude answers anyway
  Not quite. The result refers to a call that isn't in the history.
- [x] The API rejects the request
  Right. A tool_result has to answer a tool_use from the turn just before it, and there isn't one.
- [ ] Claude calls the tool again
  Not quite. The request fails before Claude sees it.
:::

That's one call and one answer. Real assistants often need several calls in a
row (look up a city, then its weather, then a packing list). That's the
**agent loop**, and it gets its own course. Here, you'll get the single call
right first.

:::rabbithole
- read "Handle tool calls" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"
- read "How tool use works" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works"
:::
