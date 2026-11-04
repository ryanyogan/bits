---
# sources (checked 2026-11-03):
# - Cloudflare Agents, Client SDK (AgentClient, query params on the socket)
#   https://developers.cloudflare.com/agents/api-reference/agents-api/
# - Installed agents 0.33.0 docs: client-sdk.md, resumable-streaming.md (chunks buffered in SQLite, a reconnecting
#   client can resume a reply)
# - AI SDK, readUIMessageStream https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream
# - Klippy c-03 → c-04, recorded output docs/outputs/c-04.txt (2026-11-03, tsx 4.23.15). The Workers AI fallback
#   (@cf/zai-org/glm-4.7-flash) answered, not Claude: the gateway had no Anthropic key.
title: "Talk to Klippy from your terminal"
order: 4
minutes: 25
xp: 70
module: An agent of your own
device: desk
tag: c-03
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  tsx: "4.23.15"
---

Klippy is an agent now, but nothing talks to it. This lesson gives it a
chat in your terminal: `pnpm chat sam` opens a conversation with the
Klippy called `sam`, and replies stream in word by word.

### 1. A script again

The chat is a script on your machine, like last lesson's loop, so `tsx`
comes back. From `klippy/`:

```sh
pnpm --filter agent add -D --save-exact tsx@4.23.15
```

In `apps/agent/package.json`, add `"chat": "tsx --env-file=.dev.vars scripts/chat.ts"`
to `scripts`, and put `"scripts/**/*.ts"` back in `tsconfig.json`'s
`include`. The script reads `KLIPPY_TOKEN` from your `.dev.vars`.

### 2. Open one WebSocket

A chat is many messages back and forth, with replies arriving in pieces.
A **WebSocket** suits that: one connection, kept open, messages both ways.
Make `apps/agent/scripts/chat.ts`:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-04" highlight="6-14" label="apps/agent/scripts/chat.ts"}
import { WebSocketChatTransport } from 'agents/chat/transport';
import { AgentClient } from 'agents/client';
import { readUIMessageStream, type UIMessage } from 'ai';
import { createInterface } from 'node:readline/promises';

// `pnpm chat alice` talks to the Klippy called "alice". KLIPPY_TOKEN comes from .dev.vars.
const url = new URL(process.env.KLIPPY_URL ?? 'http://localhost:8787');
const name = process.argv[2] ?? 'me';
const token = process.env.KLIPPY_TOKEN ?? '';

// One WebSocket to this Klippy, kept open for the whole chat. A WebSocket can't send headers, so the token rides
// in the query string (the Worker allows that only for the socket, and strips it before the agent sees it).
const agent = new AgentClient({ agent: 'Klippy', name, host: url.host, protocol: url.protocol === 'https:' ? 'wss' : 'ws', query: { token } });
const transport = new WebSocketChatTransport({ agent });
:::

- `KLIPPY_URL` says where Klippy runs. It defaults to wrangler's port,
  8787; set it to your deployed address later.
- `AgentClient` opens the socket to `/agents/klippy/<name>`. The token goes
  in `query`, the one place last lesson allowed it.
- `WebSocketChatTransport` speaks the chat protocol over that socket.

### 3. Start from the chat Klippy already has

The conversation lives in the agent, not in your script. So load it first:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-04" highlight="2-5" label="apps/agent/scripts/chat.ts"}
// Start from the conversation this Klippy already has (it lives in the agent, not here).
const history = await fetch(new URL(`/agents/klippy/${name}/get-messages`, url), { headers: { Authorization: `Bearer ${token}` } });
if (!history.ok) throw new Error(`Klippy said ${history.status}: is the Worker running, and is KLIPPY_TOKEN right?`);
let messages: UIMessage[] = await history.json();
console.log(`Talking to Klippy "${name}" (${messages.length} messages so far). Ctrl+D to quit.`);
:::

`get-messages` is a route every chat agent has. It's plain HTTP, so the
token goes in the header.

### 4. Read your lines, send them, print the stream

The rest of the file is the chat itself:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-04" highlight="5-15" label="apps/agent/scripts/chat.ts"}
const terminal = createInterface({ input: process.stdin, output: process.stdout });
process.stdout.write('you> ');
for await (const text of terminal) {
	if (!text.trim()) { process.stdout.write('you> '); continue; }
	messages = [...messages, { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
	const stream = await transport.sendMessages({ chatId: name, messages, trigger: 'submit-message', messageId: undefined, abortSignal: undefined });
	// The reply arrives in chunks. Each step gives the whole message so far: print only what's new.
	process.stdout.write('klippy> ');
	let printed = 0;
	let reply: UIMessage | undefined;
	for await (reply of readUIMessageStream({ stream })) {
		const text = reply.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
		process.stdout.write(text.slice(printed));
		printed = text.length;
	}
	if (reply) messages = [...messages, reply];
	process.stdout.write('\nyou> ');
}
agent.close();
:::

- Each line you type becomes a user message, added to the history.
- `sendMessages` sends the conversation; the reply comes back as a stream
  of chunks.
- `readUIMessageStream` turns the chunks into a growing message. Each step
  gives the **whole** reply so far, so the script prints only the new
  characters (`slice(printed)`).

The agent stores every reply too: if your connection drops mid-reply, a
client that reconnects can pick it up where it left off. This script
doesn't show that, but the agent does it for you.

### 5. Talk to Klippy

Terminal 1, from `klippy/`: `pnpm dev`. Terminal 2, in `apps/agent`:

```sh
pnpm chat sam
```

Our run. The free Workers AI fallback answered, not Claude (the gateway had
no Anthropic key). Our dev server was on port 8801, hence `KLIPPY_URL`, and
we piped the lines in, so they don't echo after `you>`. Typed by hand, they
do.

:::terminal{cmd="printf &quot;Hi, I am Sam.\nWhat is the weather in Dublin right now?\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat sam"}
Talking to Klippy "sam" (0 messages so far). Ctrl+D to quit.
you> [synapse]klippy>[text] Hello Sam! I'm Klippy, your friendly personal assistant. How can I help you today?
you> [synapse]klippy>[text] It's currently 11°C (52°F) in Dublin with clear skies and light winds at 17.6 km/h.
:::

Then a new run with the same name, and one with a different name:

:::terminal{cmd="printf &quot;What is my name?\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat sam"}
Talking to Klippy "sam" [volt](4 messages so far)[text]. Ctrl+D to quit.
you> [synapse]klippy>[text] Hi Sam!
:::

:::terminal{cmd="printf &quot;What is my name?\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat alex"}
Talking to Klippy "alex" (0 messages so far). Ctrl+D to quit.
you> [synapse]klippy>[text] I don't have any information about you or your name. [muted](…)
:::

`sam` kept its chat across runs; `alex` is a different Klippy, with its
own. That's short-term memory: the chat itself. Next lesson adds memory
that outlives it.

If you see `Klippy said 401`, `KLIPPY_TOKEN` in `.dev.vars` doesn't match
the one the Worker was started with: restart `pnpm dev`. If it hangs,
check `KLIPPY_URL` points at the port `pnpm dev` printed.

No new tests this time: the script is a client, `pnpm typecheck` checks
it, and the agent's tests are last lesson's.

:::quiz{id="why-load-history" xp=20}
Why does the script load the chat from the agent before you type?

- [ ] The WebSocket can't open until it has the history
  Not quite. The socket opens on its own. The history is about what gets sent.
- [x] Each turn sends the whole conversation, and the agent holds the real copy, so the script starts from it
  Right. Your script is just a window onto the chat the agent keeps.
- [ ] To check the token works
  Not quite. That's a happy side effect (a 401 shows up early), not the reason.
:::

Your code matches tag `c-04`
([changes from c-03](https://github.com/ryanyogan/klippy/compare/c-03...c-04)).

:::rabbithole
- read "Agents API: client" by="Cloudflare" url="https://developers.cloudflare.com/agents/api-reference/agents-api/"
- read "readUIMessageStream" by="AI SDK" url="https://ai-sdk.dev/docs/reference/ai-sdk-ui/read-ui-message-stream"
:::
