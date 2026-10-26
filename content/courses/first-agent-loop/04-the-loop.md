---
title: The loop
order: 4
minutes: 10
xp: 60
module: Building the loop
replies:
  hint: Look at what the API requires after a tool_use block. What’s missing if line 31 is gone?
  fallback: Good guess. Now delete line 31, hit Run, and read the first line of the error out loud.
---

::ask[why does the loop check stop_reason?]{points-at="agent.ts"}

Every reply comes with a reason the model stopped talking. If it’s
`"tool_use"`, it wants you to run a tool and hand back the result. Anything
else means it’s finished.

:::code{file="agent.ts" lang="ts" copy type-mode highlight="12-32" label="the loop" focus=31}
import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const client = new Anthropic();

type Msg = Anthropic.MessageParam;

export async function agent(task: string) {
  const messages: Msg[] = [{ role: "user", content: task }];

  // the loop: think → act → observe → repeat
  while (true) {
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1024,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return res; // the model is done talking
    }

    const results = await Promise.all(
      res.content
        .filter((b) => b.type === "tool_use")
        .map(runTool),
    );
    messages.push({ role: "user", content: results });
  }
}
:::

:::code{file="tools.ts" lang="ts" copy}
import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [{
  name: "get_weather",
  description: "Current weather for a city",
  input_schema: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
}];

export async function runTool(block: Anthropic.ToolUseBlock) {
  const { city } = block.input as { city: string };
  const weather = { temp_f: 41, sky: "overcast", city };
  return { type: "tool_result" as const, tool_use_id: block.id, content: JSON.stringify(weather) };
}
:::

:::code{file=".env.example" lang="env" copy}
# Get a key at console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-…
:::

:::terminal{cmd='npx tsx agent.ts "Weather in Chicago?"'}
[ion]turn 1[quiet] stop_reason=[volt]"tool_use"[quiet] → get_weather
[ion]turn 2[quiet] stop_reason=[volt]"end_turn"
41°F and overcast in Chicago.
:::

:::terminal{cmd='npx tsx agent.ts "Weather in Chicago?"' ask="run it" summary="✓ 2 turns · 1 tool call · 1.8s"}
[ion]→ tool_use    [quiet]get_weather({ city: "Chicago" })
[volt]← tool_result [quiet]{ temp_f: 41, sky: "overcast" }
[ion]→ end_turn    [quiet]"41°F and overcast in Chicago."
:::

Two turns: one to ask for the weather, one to answer. Now break it on purpose.
Delete ==line 31== and run it again.

:::quiz{id="break-the-loop" xp=10}
Predict first — does it loop forever, or crash?

- [ ] loops forever
  Close, but the API stops it first: a tool_use turn must be answered with a tool_result, so the next request is rejected.
- [x] crashes
  Right. The next request ends on a tool_use with no tool_result, so the API rejects it before the loop can spin.
- [ ] works fine
  Not quite. Without line 31 the tool result never goes back, and the API refuses the next request.
:::
