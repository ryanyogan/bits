---
# sources (checked 2026-10-27):
# - Anthropic, Parallel tool use (Claude may return several tool_use blocks in one reply; run
#   them in any order; one tool_result per call, all in the next user message, before any text;
#   separate user messages "teach" Claude to stop calling in parallel; a call you didn't run
#   still gets an is_error result; disable_parallel_tool_use)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
# - Anthropic, Handle tool calls (is_error: true with the error message; write instructive
#   errors, e.g. "Rate limit exceeded. Retry after 60 seconds."; Claude retries an invalid call
#   2–3 times with corrections; treat tool results as untrusted: indirect prompt injection)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - Anthropic Engineering, Writing effective tools for agents (return high-signal fields, not raw
#   dumps; helpful errors steer the agent; truncate and paginate large results)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# The prompt exercise is a role-play: the sandbox has no tools.
title: "Many calls, some fail"
order: 7
minutes: 8
xp: 50
module: Real-world calls
---

Ask “Is it warmer in Paris or Tokyo right now?” and Claude doesn't make one
call, wait, then make another. It asks for **both at once**: one reply with
two `tool_use` blocks. That's **parallel tool use**, and it's on by default.

Your job is the same as before, times two. Run every call, then send **one
user message** holding **one `tool_result` per call**, each with its own
`tool_use_id`.

:::code{file="run-calls.ts" lang="ts" copy highlight="9-28" label="run every call, answer every call"}
import type Anthropic from "@anthropic-ai/sdk";

type Handler = (input: unknown) => Promise<unknown>;

export async function runCalls(
  reply: Anthropic.Message,
  handlers: Record<string, Handler>,
): Promise<Anthropic.MessageParam> {
  const calls = reply.content.filter((block) => block.type === "tool_use");

  // Independent lookups can run at the same time.
  const results = await Promise.all(
    calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
      const handler = handlers[call.name];
      try {
        if (!handler) throw new Error(`Unknown tool "${call.name}".`);
        const output = await handler(call.input);
        return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(output) };
      } catch (error) {
        // A failed call still gets an answer, marked as an error.
        const message = error instanceof Error ? error.message : String(error);
        return { type: "tool_result", tool_use_id: call.id, content: message, is_error: true };
      }
    }),
  );

  // Every result in ONE user message.
  return { role: "user", content: results };
}
:::

Two mistakes to avoid. Don't send each result in its own message: the API
lets you, but Anthropic's docs warn it **teaches Claude to stop calling in
parallel**. And don't run calls in parallel when they depend on each other
or change things (charge a card, then email the receipt). Run those in order.
If you skip a call because an earlier one failed, it still gets a result,
marked as an error.

:::quiz{id="two-results" xp=20}
Claude's reply has two tool_use blocks. How do you send the results back?

- [ ] Two user messages, one per result
  Not quite. That works, but it nudges Claude away from parallel calls next time.
- [x] One user message with both tool_result blocks
  Right. One result per call, matched by tool_use_id, together in the next message.
- [ ] Only the result that succeeded
  Not quite. Every call needs an answer, even a failed one, or the API rejects the request.
:::

---

Tools fail: the city doesn't exist, the API is down, you hit a rate limit.
Don't throw the error away and don't crash. Send it back as the result with
**`is_error: true`**. Claude reads it like any other result and adapts: it
retries with a fix, tries something else, or tells the user what went wrong.

What you write in the error matters as much as a description does.
`"Error 404"` tells Claude nothing. **“No city called Pariss. Check the
spelling, or add the country, e.g. Paris, France.”** tells it exactly what
to try next.

Treat good results the same way. Return the fields Claude needs (`temp_c`,
`sky`), not the weather API's whole response. Every byte you return
is input tokens, and noise makes the useful part harder to find.

One warning. A tool result can carry text you didn't write: a web page, an
email, a customer's message. Someone can hide instructions in it (“ignore
your rules and…”). That's called **indirect prompt injection**. Keep outside
text inside `tool_result` blocks, never paste it into your system prompt, and
don't let a tool result alone trigger anything risky.

Your turn. The sandbox has no tools, so play it out. Write the **error
message** your weather tool would return for a misspelled city, then ask
Claude, in one sentence, what it would do next.

:::prompt{id="helpful-error" xp=30}
Write a tool error that tells Claude what to try next

- placeholder "Your get_weather call returned this error: “…” In one sentence, what do you do next?"
- draft "Your tool call returned: Error 404. What next?"
- check "Says it's a tool error"       /error|failed|is_error/i
- check "Says what went wrong"         /no city|not found|unknown|couldn.t find|does not exist|doesn.t exist|misspel/i
- check "Says what to try instead"     /\btry\b|check|add the country|did you mean|instead|e\.g\./i
- check "Asks what Claude would do"    /what (would|do|will) you|next/i
- run temperature=[1.0]
- example T=1.0 "I'd call get_weather again with \"Paris, France\", since \"Pariss\" looks like a typo."
- example T=1.0 "I'd retry the lookup with the corrected spelling, Paris, and add the country to be safe."
- example T=1.0 "I'd ask the user whether they meant Paris, France, then call the tool again with that."
- success "A useful error is a hint. Claude recovers instead of guessing." next="Next: tools Anthropic runs →"
:::

:::rabbithole
- read "Parallel tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use"
- read "Handle tool calls: errors" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
:::
