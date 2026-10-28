---
# sources (checked 2026-10-27):
# - Anthropic, Building effective agents (agents' "potential for compounding errors"; ground
#   truth at each step; stopping conditions such as a maximum number of iterations)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Anthropic, Writing effective tools for agents (2025-09-11: helpful vs unhelpful error
#   responses; truncate, paginate or filter big results; Claude Code caps tool responses at
#   25,000 tokens by default)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# - Anthropic docs, Handle tool calls (is_error; instructive error messages, e.g. "Rate limit
#   exceeded. Retry after 60 seconds.")
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - Code typechecked against @anthropic-ai/sdk 1.3.0 (2026-10-27). The stuck-loop trace and
#   the compare rows are illustrative.
title: "When loops go wrong"
order: 7
minutes: 8
xp: 40
module: Building the loop
---

A loop with no end is the classic agent bug. The model isn't broken and
neither is your `while`. Almost always, the model is **reacting sensibly to
a bad tool result**, over and over.

Here's a typical stuck run. The tool fails with a message that tells the
model nothing, so it does the only reasonable thing: tries again.

:::terminal{cmd='npx tsx agent.ts "Weather in Springfield tomorrow?"' summary="illustrative · still going after 30 turns"}
[ion]turn 1[quiet] → geocode("Springfield")       [synapse]← Error
[ion]turn 2[quiet] → geocode("Springfield")       [synapse]← Error
[ion]turn 3[quiet] → geocode("Springfield, USA")  [synapse]← Error
[ion]turn 4[quiet] → geocode("Springfield")       [synapse]← Error
[quiet]…
:::

That trace is illustrative, but the pattern is real. Three things went
wrong at once: the error was **opaque**, the question was **ambiguous** (there
are dozens of Springfields), and the loop had **no limit**.

---

**Fix the result first.** The tool result is the model's only view of what
happened, so write errors for it. Say what went wrong and what to try next.

:::compare{left="Opaque result" right="Actionable result" illustrative}
- prompt "geocode(\"Springfield\") failed"
- left "Error"
- right "Found 30+ places called Springfield. Ask the user which state or country they mean, or pass e.g. \"Springfield, Illinois\"."
- prompt "get_forecast returned a week of hourly data"
- left "[ {\"time\": \"2026-10-27T00:00\", \"temperature_2m\": 53.8, …}, … 167 more ]"
- right "Daily summary for 2 days: high, low, top rain %, top wind. Ask for days=3 to 7 if you need more."
:::

The second pair is the other bad result: **too much**. A giant result fills
the context window, costs tokens on every later turn, and buries the one
number that matters. Anthropic's own advice is to paginate, filter or
truncate big results, and Claude Code caps a tool's response at 25,000 tokens
by default. Return the few fields the model needs.

---

**Then guard the loop.** Even with good errors, a model can circle. Two cheap
guards catch it: a turn limit (more in lesson 9), and a check for the same
call with the same input, again and again.

:::code{file="guards.ts" lang="ts" copy highlight="6-10" label="same call, same input"}
import type Anthropic from "@anthropic-ai/sdk";

const seen = new Map<string, number>();

export function repeatGuard(call: Anthropic.ToolUseBlock): Anthropic.ToolResultBlockParam | undefined {
  const key = `${call.name}:${JSON.stringify(call.input)}`;
  const count = (seen.get(key) ?? 0) + 1;
  seen.set(key, count);
  if (count < 3) return undefined; // fine: run the tool
  return {
    type: "tool_result",
    tool_use_id: call.id,
    is_error: true,
    content: "You've made this exact call 3 times. Stop retrying: change the input, or tell the user what's missing.",
  };
}
:::

Notice the guard doesn't crash the agent. It answers the call with an error
the model can act on. In the loop, check `repeatGuard(call)` first and only
run the tool if it returns nothing.

:::quiz{id="stuck-loop" xp=15}
Your agent calls search_docs 40 times with slightly different queries, and every result is "0 results". What's the most likely root cause?

- [x] The tool result gives the model nothing to change course with
  Right. "0 results" over and over leaves only one move: try again. Say what was searched and suggest what to try, or let the model tell the user.
- [ ] The model is too small for the task
  Not usually. A bigger model gets stuck on the same uninformative result, just more expensively.
- [ ] Temperature is too high
  Not quite. Current Claude models don't take a temperature at all, and randomness isn't what keeps it looping.
:::

---

Your turn. Ask Claude to rewrite an unhelpful tool error into one an agent
could act on. Paste the bad error, say what the tool does, and set a length
limit.

:::prompt{id="actionable-error" xp=25}
Ask Claude to turn a useless tool error into an actionable one

- placeholder "My tool get_forecast returns the error \"…\". Rewrite it so an AI agent knows what went wrong and what to try next, in under … words."
- draft "Rewrite this error: \"Error 400\"."
- check "Includes the bad error"         /error|failed|invalid|\b4\d\d\b|\b5\d\d\b/i
- check "Says what the tool does"        /\btool\b|forecast|geocode|search|lookup|look up/i
- check "Asks for a next step"           /next|instead|try|fix|suggest|what to do/i
- check "Sets a length limit"            /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b|\bmax/i
- run temperature=[1.0]
- example T=1.0 "\"days must be between 1 and 7 (you sent 14). Day 1 is today. Call get_forecast again with days=7, and tell the user the forecast only covers a week.\""
- example T=1.0 "\"Invalid request: 'days' was 14, but the forecast covers at most 7 days. Retry with days set to 7 or less.\""
- example T=1.0 "\"get_forecast couldn't run: latitude must be a number, but got 'Chicago'. Call geocode first to get coordinates, then pass those.\""
- success "Every one of those tells the agent its next move. That's what ends loops." next="Next: memory →"
:::

:::rabbithole
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
- read "Handle tool calls" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"
:::
