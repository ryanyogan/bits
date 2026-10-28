---
# sources (checked 2026-10-27):
# - Anthropic, Building effective agents ("stopping conditions (such as a maximum number of
#   iterations) to maintain control"; higher costs and compounding errors)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Anthropic, Writing effective tools for agents (track runtime, number of tool calls,
#   token consumption and tool errors)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# - Anthropic, Pricing (Claude Sonnet 5.5: $2 / MTok input, $10 / MTok output)
#   https://platform.claude.com/docs/en/about-claude/pricing
# - Anthropic docs, Tool runner (max_iterations; ANTHROPIC_LOG=info|debug turns on the
#   TypeScript SDK's request/response logging)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner
# - Claude API skill: task budgets (beta) tell Claude its remaining token budget so it paces
#   itself; advisory, unlike your own limit; SDK retries 2 times by default
# - Code typechecked against @anthropic-ai/sdk 1.3.0 (2026-10-27). Token counts and the log
#   lines are illustrative.
title: "Limits and logs"
order: 8
minutes: 8
xp: 40
module: Shipping it
---

Every loop you ship needs a way to stop that doesn't depend on the model
deciding to. Anthropic's own advice for agents is to add **stopping
conditions**, such as a maximum number of turns, so you stay in control.

Here's why it matters for your bill. Each turn re-sends the whole history, so
a run's input grows with every turn. With illustrative numbers on Claude
Sonnet 5.5 ($2 per million input tokens, $10 per million output, as of
October 2026):

A normal three-turn weather run sends about 4,600 input tokens in total and
gets back about 500. That's 4,600 × $2 + 500 × $10, per million: about
**1.4 cents**. A stuck run that goes 30 turns, with the history growing 400
tokens a turn, sends about 210,000 input tokens: about **47 cents**. Ten times
the turns, over thirty times the cost.

---

Three limits cover most of it. A **turn limit** stops circling. A **token
budget** stops a run that's technically making progress but costing a
fortune. And each request keeps its own `max_tokens`, so no single reply runs
away.

:::code{file="agent.ts" lang="ts" copy highlight="5-6" label="the limits"}
import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const client = new Anthropic();
const MAX_TURNS = 8;
const TOKEN_BUDGET = 60_000; // input + output, summed over turns
const run = crypto.randomUUID().slice(0, 8);

export async function agent(history: Anthropic.MessageParam[], task: string) {
  history.push({ role: "user", content: task });
  let spent = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (spent > TOKEN_BUDGET) return `Stopped: over ${TOKEN_BUDGET} tokens.`;
    const started = Date.now();
    const res = await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 16000, tools, messages: history });
    history.push({ role: "assistant", content: res.content });
    spent += res.usage.input_tokens + res.usage.output_tokens;
    const calls = res.content.filter((b) => b.type === "tool_use");
    log({ turn, stop: res.stop_reason, calls: calls.map((c) => c.name), spent, ms: Date.now() - started });

    if (res.stop_reason === "end_turn") return res;
    if (res.stop_reason !== "tool_use") return `Stopped: ${res.stop_reason}.`;
    history.push({ role: "user", content: await Promise.all(calls.map(runTool)) });
  }
  return `Stopped: no answer after ${MAX_TURNS} turns.`;
}

function log(fields: Record<string, unknown>) {
  console.error(JSON.stringify({ at: new Date().toISOString(), run, ...fields }));
}
:::

::ask[why check the budget at the top of the loop, not after the call?]{points-at="agent.ts"}

Because of what's in `history` at that moment. At the top, the last message
is either the user's question or a full set of tool results, so the
conversation is valid and the user can carry on. Stop right after a
`tool_use` reply and you'd leave a call with no result, and the next request
would be rejected.

When a limit hits, **say so**. Return a message that tells the user the agent
stopped and why. Never dress up a half-finished run as an answer.

:::quiz{id="hit-the-limit" xp=15}
Your agent hits MAX_TURNS while still calling tools. What should it return?

- [ ] The last text Claude wrote, as if it were the answer
  Not quite. That text was written mid-task. Passing it off as final is how agents end up confidently wrong.
- [x] A clear “stopped after 8 turns” message, and a log line saying so
  Right. The user knows it didn't finish, and your logs show which runs need a look.
- [ ] Nothing. Raise MAX_TURNS until it never happens.
  Not quite. Then the one stuck run you didn't foresee runs until the bill stops it.
:::

---

Limits stop the damage; **logs** tell you what happened. One JSON line per
turn is enough to start: a run id, the turn, the stop reason, which tools ran,
tokens so far and how long it took. Anthropic tracks the same signals when it
tunes its own tools: runtime, number of calls, tokens and tool errors.

:::terminal{cmd='npx tsx agent.ts "Bike or train in Chicago tomorrow?" 2> run.log' summary="illustrative log lines · timestamps trimmed"}
[quiet]{"run":"3f9a1c2e","turn":1,"stop":"tool_use","calls":["geocode"],"spent":1350,"ms":1420}
[quiet]{"run":"3f9a1c2e","turn":2,"stop":"tool_use","calls":["get_forecast"],"spent":3000,"ms":1610}
[quiet]{"run":"3f9a1c2e","turn":3,"stop":"end_turn","calls":[],"spent":5100,"ms":1980}
:::

Logs go to stderr, so the answer on stdout stays clean. Keep secrets and
users' personal details out of them. For more detail while you debug, set
`ANTHROPIC_LOG=debug` and the SDK logs every request and response itself.

One more lever, in beta as of October 2026: a **task budget** tells Claude how
many tokens it has left, so it can pace itself and wrap up. That helps it
finish gracefully, but it's advice to the model. Your own limits are the
ones that are guaranteed.

:::quiz{id="read-the-log" xp=15}
In the log above, why does "spent" grow faster each turn, even though each reply is short?

- [x] Each turn re-sends the whole history as input, and the history keeps growing
  Right. Turn 3 pays again for everything in turns 1 and 2. That's why long loops get expensive fast.
- [ ] The model thinks harder on later turns
  It might, but that's not the main effect. The steady climb is the history being sent again.
- [ ] Tool definitions are only sent on later turns
  Not quite. They go in with every request, from the first turn on.
:::

:::rabbithole
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
- read "Tool runner" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner"
:::
