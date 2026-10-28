---
# sources (checked 2026-10-27):
# - Anthropic docs, Handle tool calls (tool_use id/name/input; tool_result tool_use_id,
#   content, is_error; results must immediately follow the tool_use turn; tool_result blocks
#   first in the user message; write instructive error messages)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - Anthropic docs, Parallel tool use (all results in one user message)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
# - Claude API skill / model notes: current models can return thinking blocks alongside
#   tool_use; pass response.content back unchanged
# - @anthropic-ai/sdk 1.3.0 types (Anthropic.ToolUseBlock, Anthropic.ToolResultBlockParam)
title: "Running a tool"
order: 3
minutes: 7
xp: 40
module: What an agent is
---

The model never runs anything. When it wants a tool, it stops and hands you
a request, and **you** run it. That handoff is one beat of the loop, and it
has to be done exactly right.

Here's what comes back when Claude wants the forecast. `stop_reason` is
`"tool_use"`, and the content holds a `tool_use` block with an **id**, the
tool's **name** and the **input** it chose.

:::code{file="response.json" lang="json" copy=false highlight="4-9" label="the request"}
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01A9…",
      "name": "get_forecast",
      "input": { "latitude": 41.85, "longitude": -87.65, "days": 2, "units": "fahrenheit" }
    }
  ]
}
:::

The content can hold more than that: a line of text, more `tool_use` blocks,
or on current models a thinking block. That's why you push the whole
`res.content` back into the conversation, never just the parts you read.

---

Your reply is a **user** message holding a `tool_result` block. Its
`tool_use_id` must match the request's id, so the model knows which call
this answers.

:::code{file="run-tool.ts" lang="ts" copy highlight="13-22" label="answer every call"}
import type Anthropic from "@anthropic-ai/sdk";

type Handler = (input: any) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  get_forecast: async ({ latitude, longitude, days }) => {
    if (days < 1 || days > 7) throw new Error("days must be 1 to 7. Day 1 is today.");
    return fetchForecast(latitude, longitude, days);
  },
};

export async function runTool(block: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
  try {
    const handler = handlers[block.name];
    if (!handler) throw new Error(`There is no tool called "${block.name}".`);
    const result = await handler(block.input);
    return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "tool_result", tool_use_id: block.id, content: message, is_error: true };
  }
}

declare function fetchForecast(lat: number, lon: number, days: number): Promise<unknown>;
:::

::ask[why catch the error instead of letting it throw?]{points-at="run-tool.ts"}

Because a crash ends the whole agent, and the model can't learn from it. A
`tool_result` with `is_error: true` and a plain-words message goes back to
the model like any other result. It reads "days must be 1 to 7", fixes its
call and tries again. Write errors for that reader: what went wrong and what
to do instead, not a stack trace.

---

The API is strict about the shape of the reply, and breaking a rule gets you
a 400 error, not a wrong answer. The results must come in the **very next**
message after the `tool_use` turn. Every `tool_use` needs its own
`tool_result`. If the model asked for three tools, all three results go back
in **one** user message. And if you add any text of your own, the
`tool_result` blocks come first.

:::quiz{id="tool-result-rules" xp=15}
Claude asked for two tools in one turn. One worked, one threw. What do you send back?

- [ ] Only the result that worked, so the model isn't confused
  Not quite. Every tool_use needs a matching tool_result, or the next request is rejected.
- [x] One user message with both results, the failed one marked is_error
  Right. Both calls get answered, in one message, and the error tells the model what to fix.
- [ ] Two user messages, one per result, in the order they finished
  Not quite. Results for one turn belong in a single message. Anthropic's docs warn that splitting them teaches Claude to stop making calls in parallel.
:::

:::quiz{id="what-model-sees" xp=15}
What does the model see of your tool?

- [x] Its name, description and input schema, then the results you send back
  Right. Your code stays on your side. That's why the description and the result messages do all the talking.
- [ ] The function's source code, so it can predict the result
  Not quite. The model never sees your code, only the definition and what you return.
- [ ] Nothing until it calls the tool for the first time
  Not quite. The definitions go in with every request. That's how it knows the tool exists.
:::

Next lesson you'll wrap this in a `while` loop and let it run on its own.

:::rabbithole
- read "Handle tool calls" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"
- read "What are tools?" by="Matt Pocock, AI Hero" url="https://www.aihero.dev/what-are-tools"
:::
