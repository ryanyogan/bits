---
# sources (checked 2026-10-27):
# - bits course "Give your model tools" (order 5), which this lesson recaps: describing-a-tool,
#   one-round-trip, descriptions-that-work, strict-schemas, many-calls-some-fail
# - Anthropic docs, Handle tool calls (tool_use id/name/input; tool_result tool_use_id,
#   content, is_error; write instructive error messages)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - Anthropic docs, Structured outputs → JSON Schema limitations (strict tools: minimum /
#   maximum not supported; additionalProperties must be false)
#   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# - Anthropic, Building effective agents, Appendix 2 (agent-computer interface; poka-yoke your
#   tools; the coding agent's relative-path mistakes fixed by requiring absolute paths)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Anthropic, Writing effective tools for agents (2025-09-11: return high-signal, meaningful
#   context; helpful errors steer the agent)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# - @anthropic-ai/sdk 1.3.0 types (Anthropic.ToolUseBlock, Anthropic.ToolResultBlockParam)
# Toy: the compare rows are illustrative.
title: "Tools, seen from the loop"
order: 2
minutes: 7
xp: 60
module: What an agent is
---

You built the pieces of a tool call in **Give your model tools**. Here they
are in thirty seconds, with the lesson to revisit if one feels shaky.

**Describe it.** Claude sees a tool's `name`, `description` and
`input_schema`, never your code, and the description does most of the work.
Revisit [Describing a tool](/courses/give-your-model-tools/describing-a-tool) and
[Descriptions Claude follows](/courses/give-your-model-tools/descriptions-that-work).

**Run it.** A reply with `stop_reason: "tool_use"` holds `tool_use` blocks.
You push Claude's whole reply back unchanged, then one user message with a
`tool_result` per call, matched by `tool_use_id`. Revisit
[One round trip](/courses/give-your-model-tools/one-round-trip).

**Fail politely.** A failed call still gets a result, marked `is_error: true`,
with a message that says what to try next. Revisit
[Many calls, some fail](/courses/give-your-model-tools/many-calls-some-fail).

---

The weather bot made one round of calls and stopped. An agent doesn't stop:
every result becomes the input to Claude's **next plan**, maybe dozens of
times. That changes what your tool code has to get right.

First, **your tool layer must never throw.** In a loop, an exception doesn't
just lose one answer. It ends the run, and Claude never learns what went
wrong, so it can't retry or tell the user. Send every call through one
function that always returns a `tool_result`. The loop in the next lesson
imports a `runTool` just like it.

:::code{file="run-tool.ts" lang="ts" copy highlight="12-21" label="never throws"}
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

::ask[why check days in the handler if the schema could say so?]{points-at="run-tool.ts"}

Because strict schemas can't enforce `minimum` or `maximum` (as of October
2026). Put the range in the description, so Claude rarely gets it wrong, and
check it in code, so a wrong call comes back as an error Claude can fix next
turn: “days must be 1 to 7”.

:::quiz{id="escaped-error" xp=15}
Your forecast API times out, and the handler's error escapes runTool instead of becoming a tool_result. What happens to the agent?

- [ ] Claude sees the timeout and retries next turn
  Not quite. Claude only sees what you send back, and nothing was sent.
- [x] The run ends, and Claude never learns the call failed
  Right. The exception unwinds your loop. Caught and returned with is_error, the same timeout is just one more thing Claude can react to.
- [ ] The API rejects the next request
  Not quite. There is no next request: your code stopped before sending one.
:::

---

Second, **a result is the next turn's input.** Write each one to answer the
question Claude asks itself next: what can I do now? That means returning
the fields the **next tool** needs, in the names it takes. It means saying
what was **actually matched**, so Claude can catch a wrong match before it
builds three more steps on it. And it means staying small, because in a loop
every result is re-sent on every later turn.

:::compare{left="Dead-end result" right="Result the next turn can use" illustrative}
- prompt "geocode(\"Portland\") returns…"
- left "{ \"lat\": 45.52, \"lon\": -122.68 }"
- right "{ \"place\": \"Portland, Oregon, US\", \"latitude\": 45.52, \"longitude\": -122.68, \"also_found\": \"Portland, Maine, US\" }"
- prompt "What Claude does next"
- left "Renames lat and lon to fit get_forecast, and fetches Oregon's weather for a user who lives in Maine."
- right "Passes latitude and longitude straight to get_forecast, and says it picked Oregon in case the user meant Maine."
:::

Anthropic calls this designing the **agent-computer interface**, and
suggests you **poka-yoke** your tools: shape them so mistakes are hard to
make. Their coding agent kept fumbling relative file paths, so they made the
tool require absolute paths, and the mistakes stopped. Here, `get_forecast`
takes coordinates rather than a place name, so it can never guess which
Portland you meant.

:::quiz{id="better-tool" xp=15}
Your agent keeps calling get_forecast with `days: 14`, but the tool only covers 7. What's the best first fix?

- [ ] Add “never ask for more than 7 days” to the system prompt
  It might help, but the rule belongs with the tool. Every prompt that uses this tool would need to repeat it.
- [x] Say “7 days at most” in the tool's description, and return a clear error if it's exceeded
  Right. The description is where Claude looks when it fills in the input, and a clear error lets it fix the call next turn.
- [ ] Rename the tool to get_forecast_7_days
  A name can hint, but it can't explain. Descriptions are where the detail goes.
:::

---

Your turn. Give Claude two tool descriptions that are meant to chain, a
question, and ask whether it could get from one to the other. Anything it
has to guess is a step your agent would guess at too.

:::prompt{id="review-a-chain" xp=30}
Ask Claude whether two tools chain, and what it would have to guess

- placeholder "Tools: geocode — … returns … get_forecast — takes … Question: … Could you answer it with these? What would you have to guess?"
- draft "Tools: geocode, get_forecast. Could you use these?"
- check "Describes the first tool"      /geocode/i
- check "Describes the second tool"     /forecast/i
- check "Says what a tool returns"      /\breturns?\b|\bgives\b|latitude|coordinates|\bhigh\b|\brain\b/i
- check "Includes a question"           /\?/
- check "Asks what's unclear"           /unclear|ambiguous|missing|guess|confus|need to know/i
- run temperature=[1.0]
- example T=1.0 "Yes: geocode(\"Chicago\") first, then get_forecast with its coordinates. Two guesses: whether geocode's output uses the same names get_forecast takes (lat vs latitude), and which Chicago it picks if there are several."
- example T=1.0 "Mostly. I'd call geocode, then get_forecast for 2 days. I'd have to guess the units, since neither description says, and what geocode returns when it finds nothing."
- example T=1.0 "I can't chain these reliably. geocode says it returns a location but not in what form, and get_forecast says it takes coordinates. I'd be guessing how one feeds the other."
- success "Every guess Claude named is a turn your agent could waste." next="Next: the loop →"
:::

:::rabbithole
- read "Building effective agents (Appendix 2: prompt-engineering your tools)" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
- read "What are tools?" by="Matt Pocock, AI Hero" url="https://www.aihero.dev/what-are-tools"
:::
