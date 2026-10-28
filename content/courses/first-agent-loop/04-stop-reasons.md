---
# sources (checked 2026-10-27):
# - Anthropic docs, Stop reasons and fallback (end_turn, max_tokens, stop_sequence, tool_use,
#   pause_turn, refusal, model_context_window_exceeded; an incomplete tool_use at max_tokens
#   needs a retry with a higher max_tokens; pause_turn: send the response back as-is; refusal
#   is an HTTP 200 with stop_details, retry on another model)
#   https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons
# - Anthropic docs, Refusals and fallback
#   https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
# - @anthropic-ai/sdk 1.3.0: StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' |
#   'tool_use' | 'pause_turn' | 'refusal' | 'model_context_window_exceeded'
# - Code typechecked against @anthropic-ai/sdk 1.3.0 (2026-10-27).
title: "Stop reasons"
order: 4
minutes: 7
xp: 40
module: Building the loop
---

Last lesson's loop had one rule: `"tool_use"` means keep going, anything
else means done. That works on a good day. On a bad day, “anything else”
includes a reply that was **cut off halfway**, and your agent hands it to the
user as if it were finished.

As of October 2026, the API has **seven** stop reasons. Every response
carries exactly one, and each asks for something different.

**`end_turn`**: Claude finished. Use the answer. **`tool_use`**: Claude wants
your tools. Run them and loop. **`stop_sequence`**: Claude wrote one of the
`stop_sequences` you set. Most agents never set any.

---

The next two mean **cut off**. **`max_tokens`**: the reply hit the
`max_tokens` you asked for. Thinking counts towards it too, so a small limit
runs out sooner than you'd think. **`model_context_window_exceeded`**: the
whole conversation filled the model's context window. Either way, the reply
is incomplete, and if it ends in a `tool_use` block, that block's input may
be cut off too. Never run it. Retry with more room, or trim the history.

The last two are special cases. **`refusal`**: Claude declined, and it arrives
as a normal 200 response, not an error. `stop_details` says why. Don't retry
the same request in a loop; show it, or retry once on another model as
Anthropic's docs describe. **`pause_turn`**: only happens with Anthropic's
server-side tools, like web search, when their loop on Anthropic's side hits
its limit (10 rounds by default). Send the response back unchanged and Claude
carries on.

:::code{file="agent.ts" lang="ts" copy highlight="12-29" label="one case per reason"}
import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const client = new Anthropic();

export async function agent(task: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];
  while (true) {
    const res = await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 16000, tools, messages });
    messages.push({ role: "assistant", content: res.content });

    switch (res.stop_reason) {
      case "tool_use":
        break; // run the tools below, then loop
      case "end_turn":
      case "stop_sequence":
        return res; // finished
      case "max_tokens":
      case "model_context_window_exceeded":
        throw new Error(`Cut off (${res.stop_reason}). Raise max_tokens or trim history.`);
      case "refusal":
        return res; // declined: show it, don't loop on it
      case "pause_turn":
        continue; // server tools only: send it back as-is
      default:
        throw new Error(`Unexpected stop reason: ${res.stop_reason}`);
    }
    const calls = res.content.filter((b) => b.type === "tool_use");
    messages.push({ role: "user", content: await Promise.all(calls.map(runTool)) });
  }
}
:::

::ask[why have a default case if every reason is covered?]{points-at="agent.ts"}

Because the list grows. `model_context_window_exceeded` arrived in 2025, and
older models still need a beta header to send it. If a new reason shows up,
you'd rather get a loud error than an agent that silently treats it as “done”
or loops on it forever.

---

:::quiz{id="cut-off-tool" xp=15}
A response comes back with stop_reason "max_tokens", and its last block is a tool_use. What should the loop do?

- [ ] Run the tool. Claude clearly wanted it.
  Not quite. The input may have been cut off mid-way, so you'd run the tool with half an argument.
- [x] Don't run it. Retry the request with a higher max_tokens.
  Right. That's exactly what Anthropic's docs say to do with an incomplete tool_use block.
- [ ] Return the text so far as the final answer
  Not quite. The reply is incomplete, and the user would get half an answer that looks whole.
:::

:::quiz{id="refusal-loop" xp=15}
Your loop retries every response that isn't end_turn. What goes wrong when Claude refuses?

- [x] It sends the same request again and again, getting the same refusal each time
  Right. A refusal is a decision, not a glitch. Retrying the identical request just burns tokens. Show it, or fall back to another model once.
- [ ] Nothing. The SDK throws an error on a refusal.
  Not quite. A refusal is a normal HTTP 200 response. Only your code can notice it.
- [ ] The API bans the key after three refusals
  Not quite. There's no such rule. The problem is the loop you wrote.
:::

The habit to keep: **read `stop_reason` before you read the content**. The
content only means what you think it means once you know why the model
stopped.

:::rabbithole
- read "Stop reasons and fallback" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"
- read "Refusals and fallback" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback"
:::
