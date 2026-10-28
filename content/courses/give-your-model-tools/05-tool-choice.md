---
# sources (checked 2026-10-27):
# - Anthropic, Define tools, "Forcing tool use" (tool_choice auto / any / tool / none; auto is the
#   default with tools, none without; any and tool prefill the call, so no text comes before it
#   and thinking is skipped; Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 return a 400
#   for any and tool; use auto + a prompt instruction + strict tools instead; Haiku 5.5 accepts them)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic, Tool use with Claude, "When Claude uses tools" (system-prompt phrasings that make
#   tool calls more or less likely)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Anthropic, Parallel tool use (disable_parallel_tool_use lives inside tool_choice; with auto it
#   means at most one call)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
title: "Choosing when Claude calls"
order: 5
minutes: 6
xp: 40
module: Getting calls right
---

By default Claude decides for itself whether a question needs a tool. A
request field called **`tool_choice`** lets you change that. It sits next to
`tools` in the request, and it has four settings.

:::code{file="tool-choice.ts" lang="ts" copy}
import type Anthropic from "@anthropic-ai/sdk";

// Claude decides: call a tool, or just answer. The default when you send tools.
export const auto: Anthropic.ToolChoice = { type: "auto" };

// Claude must call one of the tools (it picks which).
export const any: Anthropic.ToolChoice = { type: "any" };

// Claude must call this one tool.
export const weather: Anthropic.ToolChoice = { type: "tool", name: "get_weather" };

// Claude can't call any tool this turn, even though they're defined.
export const none: Anthropic.ToolChoice = { type: "none" };

// auto, any and tool can add: at most one tool call in this reply.
export const oneAtATime: Anthropic.ToolChoice = { type: "auto", disable_parallel_tool_use: true };
:::

**`auto`** is right most of the time. Claude calls a tool when the question
maps to one and the answer isn't already in the conversation, and answers
directly for things it knows, creative tasks and small talk.

**`none`** is handy when you want a plain-text answer from a conversation
that has tools in it, such as a final summary.

---

**`any`** and **`tool`** force a call. They come with catches. The API
starts Claude's reply with the call for you, so Claude writes no explanation
before it, and it skips thinking first. And the newest large models don't
accept them at all: as of October 2026, Claude Opus 5.5, Sonnet 5.5 and
Fable 5.1 reject a forced `tool_choice` with a **400 error**. Claude Haiku
5.5 still accepts it.

The way that works on every model is to **ask in words**. Leave
`tool_choice` on `auto` and say what you want, in the system prompt or the
user message.

“Use the tools to investigate before responding” makes Claude reach for tools
more often. “Always call a tool first before responding” pushes harder. “Use
your judgment about whether to call a tool” keeps it cautious. For one
question, be direct: “What's the weather in Oslo? Use the get_weather tool.”

Asking isn't a guarantee, so check. If the reply has no `tool_use` block when
you needed one, handle it: show the text, or ask again. Your lesson 3 code
already does this.

:::quiz{id="pick-a-choice" xp=20}
Your support bot has tools, but on the last turn you want a plain summary of the chat, with no more lookups. Which setting?

- [ ] auto
  Not quite. Claude might decide to look something up again.
- [x] none
  Right. The tools stay defined, but Claude can't call them this turn.
- [ ] any
  Not quite. That forces a tool call, the opposite of what you want.
:::

:::quiz{id="forced-on-opus" xp=20}
You move a working app from Claude Haiku 5.5 to Claude Opus 5.5. It sends `tool_choice: { type: "tool", name: "extract_invoice" }`. What happens, and what's the fix?

- [ ] It works the same
  Not quite. Opus 5.5 doesn't accept forced tool use.
- [x] A 400 error. Use auto and tell Claude to use extract_invoice in the prompt.
  Right. Then check that the call came back, and add strict: true (next lesson) so its input matches your schema.
- [ ] Claude ignores the setting and answers in text
  Not quite. The API refuses the request, so the setting isn't silently dropped.
:::

:::rabbithole
- read "Define tools: forcing tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
- read "Tool use with Claude: when Claude uses tools" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview"
:::
