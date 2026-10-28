---
# sources (checked 2026-10-27):
# - Anthropic docs, Parallel tool use (on by default; several tool_use blocks in one turn;
#   all results in one user message; "Only batch tool calls that are independent of each
#   other"; a call that fails for a missing prerequisite gets is_error and Claude reissues it;
#   disable_parallel_tool_use inside tool_choice)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
# - Anthropic docs, Define tools (consolidate related operations; namespace tool names)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic, Writing effective tools for agents (too many or overlapping tools distract
#   agents; namespacing)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# - Open-Meteo geocoding and forecast APIs (free for non-commercial use, no key)
#   https://open-meteo.com/en/docs
# - Code typechecked against @anthropic-ai/sdk 1.3.0 and run against Open-Meteo (2026-10-27).
#   Terminal output is example output, not a recorded run.
title: "Many tools at once"
order: 6
minutes: 8
xp: 40
module: Building the loop
---

One tool makes a fancy function call. Two tools that feed each other make an
agent. Give Claude a **geocode** tool (city name to coordinates) and a
**get_forecast** tool (coordinates to forecast), and it chains them on its
own: it can't ask for a forecast until it knows where the city is.

You don't write that order anywhere. The descriptions say what each tool
needs and returns, and the model plans the chain from them. Your loop doesn't
change at all. You just keep a list of tools and a way to find each one by
name.

:::code{file="tools.ts" lang="ts" copy highlight="5-7" label="the registry"}
import type Anthropic from "@anthropic-ai/sdk";

type Tool = { definition: Anthropic.Tool; run: (input: any) => Promise<unknown> };

const registry: Tool[] = [geocode, getForecast];
export const tools = registry.map((t) => t.definition);
const byName = new Map(registry.map((t) => [t.definition.name, t]));

export async function runTool(block: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
  try {
    const tool = byName.get(block.name);
    if (!tool) throw new Error(`There is no tool called "${block.name}".`);
    const result = await tool.run(block.input);
    return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "tool_result", tool_use_id: block.id, content: message, is_error: true };
  }
}

declare const geocode: Tool, getForecast: Tool; // defined in the checkpoint
:::

---

Ask about **two** cities and something else happens. The two geocode calls
don't depend on each other, so Claude asks for both **in the same turn**:
two `tool_use` blocks in one response. That's parallel tool use, and it's on
by default.

Your loop already handles it. `Promise.all(calls.map(runTool))` runs every
call at once and sends all the results back in one user message. Each result
carries its `tool_use_id`, so the order they finish in doesn't matter.

:::terminal{cmd='npx tsx agent.ts "Is it warmer in Lyon or Leeds this weekend?"' summary="example output · 3 turns · 4 tool calls"}
[ion]turn 1[quiet] stop_reason=[volt]"tool_use"[quiet] → geocode(Lyon), geocode(Leeds)
[ion]turn 2[quiet] stop_reason=[volt]"tool_use"[quiet] → get_forecast(45.76, 4.84), get_forecast(53.80, -1.55)
[ion]turn 3[quiet] stop_reason=[volt]"end_turn"
Lyon, by a few degrees on both days. Leeds looks cooler and windier.
:::

That trace is example output: the tool calls are what the loop does, but
the forecast in the last line is made up. Three turns, four calls. Without
parallel calls it would have taken five turns, and every turn re-sends the
whole conversation, so fewer turns means less waiting and lower bills.

Sometimes Claude batches calls that **do** depend on each other, like a
forecast before its geocode has returned. The fix from Anthropic's docs: a
line in the system prompt, “Only batch tool calls that are independent of
each other.” If one slips through, return an `is_error` result for it, and
Claude asks again next turn.

:::quiz{id="parallel-results" xp=15}
Claude asked for geocode(Lyon) and geocode(Leeds) in one turn. Leeds came back first. How do you send the results?

- [x] Both in one user message, in any order, each with its own tool_use_id
  Right. The ids tie each result to its call, so the order doesn't matter. One message keeps Claude happy to batch calls next time.
- [ ] Leeds now, then Lyon in a second message when it arrives
  Not quite. Results for one turn go back together, in a single user message.
- [ ] Both in one message, but they must be sorted into the order Claude asked
  Not quite. Sorting does no harm, but the tool_use_id is what matches each result to its call.
:::

---

So should you hand an agent fifty tools? Anthropic's advice runs the other
way: **fewer, sharper tools**. Overlapping tools make the model hesitate
between them, and every definition costs input tokens on every turn.
Merge related actions into one tool with an `action` input, and when you
have many, prefix names by service, like `weather_forecast` and
`calendar_create`.

:::quiz{id="tool-count" xp=10}
Your agent has get_weather, get_forecast and weather_lookup, which all do roughly the same thing. It often picks the wrong one. What's the best fix?

- [ ] Add a fourth tool that explains which of the three to use
  Not quite. That's more overlap, not less.
- [x] Merge them into one well-described tool
  Right. Fewer, clearer choices beat a long menu of near-twins.
- [ ] Turn off parallel tool use
  Not quite. That limits Claude to one call per turn, but it won't help it choose between look-alikes.
:::

:::rabbithole
- read "Parallel tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use"
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
:::
