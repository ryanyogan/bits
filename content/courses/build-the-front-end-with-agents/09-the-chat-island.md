---
# sources (checked 2026-11-03):
# - Installed remix 3.1.0 docs: guide 05 (clientEntry, run(), handle.update, handle.queueTask, handle.signal), the
#   render-middleware README
# - Context7 /cloudflare/agents: routing (server-side instance selection with basePath), WebSocketChatTransport
# - Klippy d-08 → d-09, docs/outputs/d-09.txt (2026-11-03; agents 0.33.0, ai 7.0.162, esbuild 0.28.2). The code was
#   written by an agent against the prompt, not recorded from a fresh run. The browser run is real (headless Chromium,
#   a local test cookie); the Workers AI fallback answered, not Claude.
title: "The chat island"
order: 9
minutes: 30
xp: 90
module: Build the chat
device: desk
tag: d-08
verified: 2026-11-03
versions:
  remix: "3.1.0"
  agents: "0.33.0"
  ai: "7.0.162"
  esbuild: "0.28.2"
---

Every page so far is HTML from the server. The chat needs to stream in the
browser, so it becomes an **island**: one interactive component on a
server-rendered page. It does what `pnpm chat` does in your terminal:
stream replies, and show Approve and Deny on a tool that waits for you.

### 1. The prompt

Fresh session, plan mode:

```text
Goal: make / a live chat: a Remix island that streams Klippy's replies and shows Approve / Deny on a waiting tool,
so the browser does everything `pnpm chat` does.
Use the remix skill: read guide 05 (interactivity) and the render-middleware README. Use Context7 for the agents
routing docs (basePath, server-side instance selection). scripts/chat.ts is the protocol reference.
Constraints:
- One island, clientEntry('/assets/chat.js#Chat'), built by one esbuild command into public/assets (gitignored),
  run by wrangler's build.command. Reuse app/ui's components.
- The browser connects to /chat on this site only. The web Worker checks the user and the Origin, then forwards the
  upgrade with agentFetch; the token and the agent name never reach the browser.
- Add only agents and esbuild, pinned. No React, no @cloudflare/ai-chat/react.
Plan first, then wait for my go-ahead.
Done when typecheck and remix doctor pass, a reply streams in the browser, an approval continues the same reply,
and a wrong KLIPPY_TOKEN shows an error instead of an empty chat. Report the files and outputs.
```

- **`scripts/chat.ts` is the protocol reference.** You wrote that in
  course C. The agent doesn't have to guess the approval messages.
- **The browser connects to `/chat` on this site only.** Same rule as
  lesson 5: no token, no agent name in the browser.

### 2. The server side: check, then forward

The web Worker accepts the socket only from a signed-in user on this
site's own page, then hands it to that user's Klippy:

:::code{file="apps/web/app/actions/controller.tsx" lang="ts" tag="d-09" highlight="7-12" label="apps/web/app/actions/controller.tsx"}
		async chat(context) {
			const request = context.request;
			if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
				return new Response('Expected a WebSocket', { status: 426 });
			}
			// cop() only guards form posts. A socket from another site's page would carry your cookie: refuse it.
			if (request.headers.get('Origin') !== context.url.origin) {
				return new Response('Wrong origin', { status: 403 });
			}
			const headers = new Headers(request.headers);
			headers.delete('Cookie'); // the agent doesn't need your session cookie
			return agentFetch(`/agents/klippy/${agentName(context.auth.identity)}`, { headers });
		},
:::

The Origin check is new. `cop()` guards form posts, not WebSocket
upgrades, and a socket opened from another site's page would carry your
cookie.

### 3. The browser side: the stream loop

The island opens the socket with `AgentClient` (`basePath: 'chat'`), in
`handle.queueTask`, because setup also runs on the server, where there's
no WebSocket. Then the loop that draws a reply as it streams:

:::code{file="apps/web/app/actions/public/chat.tsx" lang="ts" tag="d-09" highlight="2-7" label="apps/web/app/actions/public/chat.tsx"}
	async function show(stream: ReadableStream<UIMessageChunk>, message?: UIMessage) {
		const at = message ? messages.indexOf(message) : messages.length;
		let last: UIMessage | undefined;
		for await (last of readUIMessageStream({ stream, message, terminateOnError: true })) {
			messages = [...messages.slice(0, at), last, ...messages.slice(at + 1)];
			handle.update();
		}
		announced = last?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ') ?? '';
	}
:::

Each step of `readUIMessageStream` is the **whole** reply so far, so the
island replaces one message and redraws. `message` is the paused reply
when an approval continues it, so it grows in place instead of starting
a new one. And the approval itself, the same frame your terminal sent:

:::code{file="apps/web/app/actions/public/chat.tsx" lang="ts" tag="d-09" highlight="5-7" label="apps/web/app/actions/public/chat.tsx"}
	function answer(part: ToolPart, approved: boolean) {
		const message = messages.find((m) => m.parts.some((p) => 'toolCallId' in p && p.toolCallId === part.toolCallId));
		answering.add(part.toolCallId);
		return exchange(async () => {
			transport!.expectToolContinuation();
			agent!.send(JSON.stringify({ type: MessageType.CF_AGENT_TOOL_APPROVAL, toolCallId: part.toolCallId, approved, autoContinue: true }));
			return { stream: await transport!.reconnectToStream({ chatId: 'klippy' }), message };
		});
	}
:::

Two snags we hit:

- Island props must be serializable **by type**. `UIMessage` has
  `metadata: unknown`, so the prop is typed as plain objects and cast once.
- Without JavaScript, the saved chat still renders and a `<noscript>` line
  says the live chat needs it. The brief asked for a form that still posts;
  we cut that to keep the step small.

### 4. See it stream

Our browser run (real: headless Chromium, signed in with a local test
cookie; the Workers AI fallback answered, not Claude). Times are from page
load:

:::terminal{cmd="node browser-run.mjs   # our scratch Playwright script, not in the repo"}
[0.2s] websocket opened /chat
[1.7s] YOU: Hi Klippy! Tell me in one sentence what you can do.
[8.4s] DOM: Klippy: I can help you
[9.3s] DOM: Klippy: I can help you with checking the weather, getting current time in different time zones, fetching and reading web pages, remembering facts and taking not
[9.3s] YOU: Save a note: buy oat milk on Friday
[13.4s] DOM: Klippy: Note saved: "buy oat milk on Friday"
[13.8s] approval card: saveNote [ion]Waiting for you[text] { "body": "buy oat milk on Friday" } Approve saving this note Deny
[13.8s] clicking: Approve saving this note
[14.0s] DOM: Klippy: saveNote [volt]Done[text] Note saved: "buy oat milk on Friday"
[15.2s] DOM: Klippy: saveNote Done Note saved: "buy oat milk on Friday" Note saved with ID 4!
:::

Read it honestly, because this is what reviewing looks like:

- **The first reply was cut off** at "taking not": a 300-token cap, and
  the fallback model spends some of it thinking.
- **"Note saved" arrived before you approved.** That's the model's text,
  not the tool's result. Trust the card, not the sentence.
- **The card is drawn above the text**, whatever the order things
  happened in. That makes the early "Note saved" look like it came after.
  Next lesson fixes it.

The guards, by `curl`: no upgrade gets `426`, signed out gets a redirect to
`/login`, another Origin gets `403`, this site gets `101`. With a wrong
`KLIPPY_TOKEN`, the socket gets the agent's `401` and the page shows the
error from lesson 8.

### 5. Review it

- The browser connects to `/chat`, never `/agents/…`. No `token` or agent
  name in browser code.
- `/chat` refuses: no upgrade (426), signed out (to `/login`), another
  Origin (403).
- The socket is created in the browser only, and closed on `handle.signal`.
- Approve and Deny disable after one click; the reply continues in the same
  message.
- `public/assets/` is gitignored, and `build.command` builds it.
- **Reject**: `useChat` or React imports, a token in the island or a URL,
  `innerHTML` for message text, a custom asset server for one island.

Steer prompts:

```text
The island opens the socket during setup, so the server tries too. Open it in handle.queueTask, browser only, and close it on handle.signal.
```

```text
You connect to /agents/klippy/gh-1?token=… from the browser. Connect to /chat (basePath) and let the web Worker add the token with agentFetch.
```

```text
After Approve the reply starts a new message. Pass the paused message to readUIMessageStream({ stream, message }) after transport.reconnectToStream(), as scripts/chat.ts does.
```

:::quiz{id="island-origin" xp=20}
Why does `/chat` check the Origin header when `cop()` already guards the app?

- [ ] cop() is turned off for /chat
  Not quite. It's on; it just doesn't cover this.
- [x] cop() guards form posts, and a WebSocket from another site's page would still carry your cookie
  Right. So the web Worker checks the Origin itself before it forwards the socket.
- [ ] The agent needs the Origin to pick the Klippy
  Not quite. The name comes from the session.
:::

Your repo matches tag `d-09`
([changes from d-08](https://github.com/ryanyogan/klippy/compare/d-08...d-09)).
