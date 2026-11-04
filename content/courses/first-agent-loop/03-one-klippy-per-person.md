---
# sources (checked 2026-11-03):
# - Cloudflare Agents, Chat agents (AIChatAgent, onChatMessage, this.messages, maxPersistedMessages)
#   https://developers.cloudflare.com/agents/api-reference/chat-agents/
# - Cloudflare Agents, Routing (routeAgentRequest, /agents/<class>/<name>) and Agent lifecycle
#   https://developers.cloudflare.com/agents/api-reference/routing/
# - Cloudflare Durable Objects, overview (one instance per id, its own SQLite storage, migrations new_sqlite_classes)
#   https://developers.cloudflare.com/durable-objects/
# - Installed agents 0.33.0 docs: cross-domain-authentication.md (a WebSocket can't send custom headers; prefer
#   short-lived signed tokens over a raw secret in a URL)
# - Klippy c-02 → c-03, recorded output docs/outputs/c-03.txt (2026-11-03, agents 0.33.0, @cloudflare/ai-chat 0.12.2).
#   No model is called in this lesson's recording.
title: "One Klippy per person"
order: 3
minutes: 30
xp: 80
module: An agent of your own
device: desk
tag: c-02
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
  wrangler: "4.157.0"
---

Until now, every request to Klippy started from nothing. A chat needs the
opposite: the whole conversation, kept somewhere, for each person. You
might reach for an array in the Worker. Don't: one Worker serves everyone,
so that array would hold Alice's and Bob's chats together, and vanish
whenever Cloudflare starts a fresh copy.

The fix is a **Durable Object**: a small server Cloudflare runs for you,
one per name, each with its own SQLite database. Cloudflare's agent class,
`AIChatAgent`, is a Durable Object that already knows how to store a chat.

### 0. Delete the hand-written loop

You saw the loop in the last lesson; now the framework runs it. From
`klippy/`, remove the script, its test, its `package.json` script line and
the two dev dependencies:

```sh
rm apps/agent/scripts/loop.ts apps/agent/test/loop.spec.ts
pnpm --filter agent remove @anthropic-ai/sdk tsx
```

Delete the `"loop": …` line from `apps/agent/package.json`, and the comma
it leaves at the end of the line above (JSON allows no trailing comma).
Delete the `ANTHROPIC_API_KEY` line from `.dev.vars`. Keep
`"type": "module"`.

### 1. The agent package and its two settings

```sh
pnpm --filter agent add --save-exact @cloudflare/ai-chat@0.12.2
```

`agents` needs two settings in `apps/agent/wrangler.jsonc`. Near the top,
Node compatibility:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="c-03" highlight="6-7" label="apps/agent/wrangler.jsonc"}
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "klippy",
	"main": "src/index.ts",
	"compatibility_date": "2026-11-03",
	// The agents package uses Node APIs (AsyncLocalStorage), so it needs Node compatibility.
	"compatibility_flags": ["nodejs_compat"],
:::

And at the end, after `d1_databases` (which now needs a comma):

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="c-03" highlight="1-4" label="apps/agent/wrangler.jsonc"}
	// Klippy, the agent: one Durable Object per name, each with its own SQLite database.
	"durable_objects": { "bindings": [{ "name": "Klippy", "class_name": "Klippy" }] },
	// Tells Cloudflare to create the class, with SQLite storage. Never edit a deployed tag: add a new one.
	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["Klippy"] }]
:::

- `durable_objects` binds the class `Klippy` as `env.Klippy`.
- `migrations` tells Cloudflare to create that class, with SQLite storage.
  Like a D1 migration, a deployed tag is never edited: a later change is a
  new tag.

You'll regenerate the types once the class is exported, in step 4.

### 2. Klippy, the agent

Make `apps/agent/src/agent.ts`. It starts with its imports: the agent
class, the AI SDK, the limits and model from course B, and the two tools.

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-03" label="apps/agent/src/agent.ts"}
import { AIChatAgent } from '@cloudflare/ai-chat';
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from 'ai';
import { MAX_QUESTION } from './ask';
import { underLimit } from './guard';
import { model } from './model';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';
:::

Then the class:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-03" highlight="3-5" label="apps/agent/src/agent.ts"}
// One Klippy per name. Each instance is its own Durable Object, with its own conversation in its own SQLite,
// so Alice's chat never mixes with Bob's (a global array in the Worker would hold everyone's).
export class Klippy extends AIChatAgent {
	// Keep the last 40 messages. That caps what's stored, and so what each turn sends to the model.
	maxPersistedMessages = 40;
:::

`maxPersistedMessages = 40` keeps the last 40 messages and drops older
ones. Each turn sends the whole conversation to the model, so this cap is
also a cap on what one turn costs.

Then the method that runs for every new message, with the same locks as
`/ask`:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-03" highlight="3-8" label="apps/agent/src/agent.ts"}
	// Called for every new message. this.messages already holds it, and the whole conversation before it.
	async onChatMessage(_onFinish: unknown, options?: { abortSignal?: AbortSignal }) {
		// Same locks as /ask: a message of at most 2,000 characters, and at most 10 turns a minute per Klippy.
		if (textOf(this.messages.at(-1)).length > MAX_QUESTION) {
			return new Response(`That message is over ${MAX_QUESTION} characters. Send a shorter one.`);
		}
		if (!(await underLimit(this.env, `chat:${this.name}`))) {
			return new Response('Too many messages. Wait a minute.');
		}
:::

`this.messages` already holds the new message and the whole chat before
it. `this.name` is this Klippy's name, so each person has their own rate
limit. A refusal is a plain `Response`: the chat shows it, and no model is
called.

### 3. Stream the reply

The rest of the method is course B's `generateText`, streaming:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-03" highlight="1-11" label="apps/agent/src/agent.ts"}
		const result = streamText({
			model: model(this.env),
			system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
			// The conversation so far, minus any message that was too long (it stays in the chat, but never reaches the model).
			messages: await convertToModelMessages(this.messages.filter((m) => m.role !== 'user' || textOf(m).length <= MAX_QUESTION)),
			maxOutputTokens: 300,
			tools: { getWeather, getTime },
			stopWhen: isStepCount(3),
			abortSignal: options?.abortSignal, // the client cancelled: stop paying for tokens
		});
		return result.toUIMessageStreamResponse();
	}
}
:::

- `convertToModelMessages` turns the stored chat into what the model
  reads. A message over 2,000 characters stays in the chat but never
  reaches the model.
- `maxOutputTokens: 300` and `isStepCount(3)` cap each turn.
- `abortSignal`: if you cancel, the model stops, and so does the bill.

Only the weather and time tools for now. The notes tools come back in
lesson 6, behind an approval.

Finish the file with the `textOf` helper from the repo
([`src/agent.ts` at c-03](https://github.com/ryanyogan/klippy/blob/c-03/apps/agent/src/agent.ts),
the last four lines).

### 4. Route to it, behind your token

In `apps/agent/src/index.ts`, export the class (Cloudflare finds Durable
Objects in the Worker's main file), and send `/agents/…` to it:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="c-03" highlight="7-8" label="apps/agent/src/index.ts"}
import { routeAgentRequest } from 'agents';
import { ask, MAX_QUESTION } from './ask';
import { check } from './check';
import { clientAddress, isOwner, underLimit } from './guard';
import { tidyNote } from './note';

// Durable Object classes must be exported from the Worker's main file.
export { Klippy } from './agent';
:::

:::code{file="apps/agent/src/index.ts" lang="ts" tag="c-03" highlight="1-9" label="apps/agent/src/index.ts"}
		// /agents/klippy/<name>: your agents. Only you can reach them, and they spend your model budget.
		if (url.pathname.startsWith('/agents/')) {
			const isSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
			if (!(await isOwner(request, env, isSocket))) {
				return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
			}
			url.searchParams.delete('token'); // checked: don't pass it on, so the agent never sees or logs it
			return (await routeAgentRequest(new Request(url, request), env)) ?? new Response('Not found', { status: 404 });
		}
:::

Put that block in `fetch`, right after the `/` route. `routeAgentRequest`
reads the URL: `/agents/klippy/alice` reaches the Klippy called `alice`,
creating it the first time. Every one of those requests spends your model
budget, so the token check comes first.

Now that `index.ts` exports `Klippy`, run `pnpm run cf-typegen` in
`apps/agent`. Run before the export, it types `env.Klippy` as a bare
namespace and the tests won't typecheck.

### 5. The one place the token may ride in a URL

A browser or script opening a **WebSocket** can't add an `Authorization`
header. So in `apps/agent/src/guard.ts`, `isOwner` takes the token from
`?token=` only when you allow it:

:::code{file="apps/agent/src/guard.ts" lang="ts" tag="c-03" highlight="4-9" label="apps/agent/src/guard.ts"}
// 1. Only you: send "Authorization: Bearer <KLIPPY_TOKEN>". The token is a Worker secret.
// allowQuery: a WebSocket can't send that header, so the agent's socket alone may send ?token=<KLIPPY_TOKEN>.
// Never anywhere else: a URL ends up in logs and browser history, a header doesn't.
export async function isOwner(request: Request, env: Env, allowQuery = false) {
	if (!env.KLIPPY_TOKEN) return false; // no token set: the door stays shut
	const token = allowQuery ? new URL(request.url).searchParams.get('token') : null;
	const sent = token ? `Bearer ${token}` : (request.headers.get('Authorization') ?? '');
	const [a, b] = await Promise.all([sha256(sent), sha256(`Bearer ${env.KLIPPY_TOKEN}`)]);
	return crypto.subtle.timingSafeEqual(a, b); // compare in constant time, so timing leaks nothing
}
:::

`index.ts` allows it only when the request opens a WebSocket, then deletes
it from the URL before the agent sees it. Every other route still needs
the header: a URL ends up in logs and browser history, a header doesn't.

Be honest with yourself about what's left: the WebSocket's opening request
still carries the token in its URL, and Workers Logs record incoming URLs.
So use a long random token (`openssl rand -hex 32`), and if it ever leaks,
replace it with `pnpm wrangler secret put KLIPPY_TOKEN`. Cloudflare's docs
recommend short-lived signed tokens for this; Klippy keeps one owner token
to stay simple.

### 6. Check the locks

Copy `apps/agent/test/` from tag `c-03` (it adds `agent.spec.ts` and
teaches the fake model to stream), then:

:::terminal{cmd="pnpm exec vitest run test/agent.spec.ts"}
 ✓ keeps one conversation per name
 ✓ sends the whole conversation to the model each turn
 ✓ refuses a message over 2,000 characters without calling the model
 ✓ refuses no token with a 401
 ✓ refuses a wrong token with a 401
 ✓ refuses the token in the URL of an HTTP request with a 401
 ✓ refuses the token in the URL on /ask too
 ✓ takes the token in the URL when the request opens a WebSocket
[volt] Tests  8 passed (8)
:::

And with `pnpm dev` running (port 8801 in our run), the request log shows
the same rules from outside:

:::terminal{cmd="pnpm dev"}
GET /agents/klippy/alice/get-messages [ion]401 Unauthorized
GET /agents/klippy/alice/get-messages [volt]200 OK
GET /agents/klippy/alice/get-messages [ion]401 Unauthorized
GET /agents/klippy/alice [volt]101 Switching Protocols
:::

No token, then the header, then the token in an HTTP URL (refused), then a
WebSocket with the token in its URL (accepted). There's nothing to talk to
yet: next lesson gives Klippy a chat in your terminal.

:::quiz{id="why-a-durable-object" xp=20}
Why does each person's chat live in its own Durable Object, not in an array in the Worker?

- [ ] Arrays are slow in Workers
  Not quite. Speed isn't the problem. Sharing is.
- [x] One Worker serves everyone and can restart any time, so an array would mix everyone's chats and lose them
  Right. A Durable Object is one instance per name, with its own storage that outlives a restart.
- [ ] Durable Objects are the only place a model can be called from
  Not quite. Your Worker called the model in course B. The agent is about keeping state.
:::

Your code matches tag `c-03`
([changes from c-02](https://github.com/ryanyogan/klippy/compare/c-02...c-03)).

:::rabbithole
- read "Chat agents" by="Cloudflare" url="https://developers.cloudflare.com/agents/api-reference/chat-agents/"
- read "Durable Objects" by="Cloudflare" url="https://developers.cloudflare.com/durable-objects/"
:::
