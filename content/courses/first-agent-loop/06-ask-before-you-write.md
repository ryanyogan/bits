---
# sources (checked 2026-11-03):
# - AI SDK, Tool execution approval (needsApproval, approval-requested / output-denied states)
#   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
# - Cloudflare Agents, human-in-the-loop with AIChatAgent (CF_AGENT_TOOL_APPROVAL, autoContinue)
#   https://developers.cloudflare.com/agents/concepts/human-in-the-loop/
# - Anthropic, Building effective agents (human checkpoints before consequential actions)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Klippy c-05 → c-06, recorded output docs/outputs/c-06.txt (2026-11-03). The Workers AI fallback
#   (@cf/zai-org/glm-4.7-flash) answered, not Claude.
title: "Ask before you write"
order: 6
minutes: 25
xp: 70
module: Keep it safe
device: desk
tag: c-05
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
---

Klippy is about to get your notes back: `listNotes` to read them,
`saveNote` to write one. Reading is harmless. Writing changes your data, on
the model's say-so. So before Klippy saves anything, it asks you.

This is a **human in the loop**: the agent pauses at the one step that
matters, and you decide.

### 1. One line on the server

In `apps/agent/src/agent.ts`, import `tool` from `ai` and `noteTools` from
`./tools/notes` (course B's notes tools), take `saveNote` and `listNotes`
from `noteTools(this.env.DB)` at the top of `onChatMessage`, and give them
to the model:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-06" highlight="7" label="apps/agent/src/agent.ts"}
			tools: {
				getWeather,
				getTime,
				...memoryTools(this),
				listNotes,
				// Saving a note writes to your database, so Klippy asks you first. The turn pauses until you answer.
				saveNote: tool({ ...saveNote, needsApproval: true }),
			},
:::

`needsApproval: true` is the whole server change. When the model calls
`saveNote`, the turn **stops** with the call marked `approval-requested`.
Nothing is written. The agent waits, however long, for an answer:

- **Yes**: the tool runs, and the model carries on with its result.
- **No**: the call is marked `output-denied`, the model is told, and it
  answers you without saving.

The notes live in D1, shared by every Klippy: they're your notes, not one
chat's. `/note` from course B keeps the plain `saveNote`; only the agent
asks.

### 2. The terminal does the asking

A web app with `useAgentChat` would do the rest for you. The terminal does
it by hand, which is the point: you see every message. Replace
`scripts/chat.ts` with
[the c-06 version](https://github.com/ryanyogan/klippy/blob/c-06/apps/agent/scripts/chat.ts).
Three parts changed.

**It reads the chat from the agent each turn** (`load()`), instead of
keeping its own copy: a paused turn changes the history on the server.

**After each reply, it looks for a paused tool call**, asks you, and sends
your answer:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-06" type-mode highlight="3-9" label="apps/agent/scripts/chat.ts"}
	// Did Klippy stop to ask before using a tool (needsApproval)? Then ask you, send the answer, and print the rest.
	for (;;) {
		const last = (await load()).at(-1);
		const part = last?.parts.find((p) => isToolUIPart(p) && p.state === 'approval-requested');
		if (!last || !part || !isToolUIPart(part)) break;
		const approved = (await ask(`Klippy wants to use ${getToolName(part)} with ${JSON.stringify(part.input)}. Allow? (y/n) `)) === 'y';
		transport.expectToolContinuation();
		agent.send(JSON.stringify({ type: MessageType.CF_AGENT_TOOL_APPROVAL, toolCallId: part.toolCallId, approved, autoContinue: true }));
		await print(await transport.reconnectToStream({ chatId: name }), last);
	}
:::

- `isToolUIPart` and `getToolName` (from `ai`) find the paused call and
  name it.
- The answer is one WebSocket frame: `CF_AGENT_TOOL_APPROVAL` with the
  call's id, `approved`, and `autoContinue: true`, so the agent carries on
  by itself.
- `expectToolContinuation()` then `reconnectToStream()` pick up the rest of
  the reply.

**It hands stream notices to the transport.** The agent announces the
continuing reply with a message of its own; the script passes it on:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-06" label="apps/agent/scripts/chat.ts"}
// A reply that continues after you approve a tool is announced with STREAM_RESUMING: hand it to the transport.
agent.addEventListener('message', (event) => {
	const data = JSON.parse(String(event.data));
	if (data.type === MessageType.CF_AGENT_STREAM_RESUMING) transport.handleStreamResuming(data);
	if (data.type === MessageType.CF_AGENT_STREAM_RESUME_NONE) transport.handleStreamResumeNone(data);
	if (data.type === MessageType.CF_AGENT_STREAM_PENDING) transport.handleStreamPending();
});
:::

One trap we hit while recording: `print()` must pass the paused reply to
`readUIMessageStream({ stream, message })`. Without `message`, the
continuation names a tool call the new message doesn't have, the stream
ends early, and Klippy's "Saved" sentence never prints. (The note is still
saved.)

### 3. Prove nothing is written early

Copy [`test/approval.spec.ts`](https://github.com/ryanyogan/klippy/blob/c-06/apps/agent/test/approval.spec.ts).
A fake model calls `saveNote`, the test checks D1 is still empty, then
answers over a real WebSocket with the same frame the script sends:

:::terminal{cmd="pnpm exec vitest run test/approval.spec.ts"}
 ✓ saves nothing until you approve, then saves
 ✓ saves nothing when you say no, and the model is told
[volt] Tests  2 passed (2)
:::

### 4. Try it

Our run. The Workers AI fallback answered, not Claude. We piped the input:
the first answer was `y`, the second `n`, and they don't echo.

:::terminal{cmd="printf &quot;Save a note: buy oat milk.\ny\nSave a note: cancel my gym membership.\nn\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat max"}
Talking to Klippy "max" (0 messages so far). /clear to start over, Ctrl+D to quit.
you> [synapse]klippy>[text]
[ion]Klippy wants to use saveNote with {"body":"buy oat milk"}. Allow? (y/n)[text] [synapse]klippy>[text] Done! I've saved your note: "buy oat milk" (ID: 14).
you> [synapse]klippy>[text]
[ion]Klippy wants to use saveNote with {"body":"cancel my gym membership"}. Allow? (y/n)[text] [synapse]klippy>[text] I'm unable to save that note—seems I can't add it at the moment. [muted](…)
:::

The denied note was never written. The fallback model's wording blurs why
("unable to save"); the model was told you said no, and a stronger model
usually says so.

**Where to put the line.** Ask before writes and anything you can't undo:
saving, sending, paying, deleting. Don't ask before reads, or people learn
to press `y` without looking.

:::quiz{id="approval-when" xp=20}
Which tool most needs `needsApproval: true`?

- [ ] getWeather
  Not quite. It only reads a public forecast. Asking every time would teach people to approve without reading.
- [x] A tool that sends an email for you
  Right. It acts in the world and can't be undone, so you want a human to say yes first.
- [ ] listNotes
  Not quite. Reading your own notes changes nothing.
:::

Your code matches tag `c-06`
([changes from c-05](https://github.com/ryanyogan/klippy/compare/c-05...c-06)).

:::rabbithole
- read "Human in the loop" by="Cloudflare" url="https://developers.cloudflare.com/agents/concepts/human-in-the-loop/"
- read "Tools and tool calling" by="AI SDK" url="https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling"
:::
