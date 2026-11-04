---
# sources (checked 2026-11-03):
# - Cloudflare AI Gateway, BYOK (AI > AI Gateway > your gateway > Provider Keys > Add API Key)
#   https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
# - Cloudflare Workers, Bindings https://developers.cloudflare.com/workers/runtime-apis/bindings/
# - Anthropic, Models overview (Claude Haiku 5.5, claude-haiku-5-5)
#   https://platform.claude.com/docs/en/about-claude/models/overview
# - AI SDK, generateText (maxOutputTokens, providerMetadata) https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
# - Klippy a-03 → a-04, recorded output docs/outputs/a-04.txt (2026-11-03, agents 0.33.0, ai 7.0.162).
#   The recording's gateway had no Anthropic key, so the Workers AI fallback (@cf/zai-org/glm-4.7-flash)
#   answered; the lesson says so.
title: "Your first call to Claude"
order: 4
minutes: 25
xp: 60
module: Talk to Claude
device: desk
tag: a-03
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
  agents: "0.33.0"
  ai: "7.0.162"
  "@ai-sdk/provider": "4.0.35"
---

Klippy can say hi. Now it gets a brain. In this lesson you'll add `POST
/ask`: send it a question, and it answers with Claude. The call goes
through **AI Gateway**, Cloudflare's front door for AI models, so your
Anthropic key never sits in your code.

### 1. Sign in to Cloudflare

The model runs on Cloudflare's side, even while Klippy runs on your laptop,
so wrangler needs to know who you are. Make a free account at
cloudflare.com if you don't have one, then from `klippy/`:

```sh
pnpm --filter agent exec wrangler login
```

A browser tab asks you to allow wrangler. Say yes, and the terminal prints
"Successfully logged in".

### 2. Install the AI packages

```sh
pnpm --filter agent add --save-exact agents@0.33.0 ai@7.0.162 @ai-sdk/provider@4.0.35
```

- `ai` is the **AI SDK**: one way to call any model, with `generateText`
  for a single answer.
- `agents` is Cloudflare's Agents SDK. You'll use one piece of it today:
  `createAI`, which connects the AI SDK to AI Gateway.
- `@ai-sdk/provider` holds the shared types both need.

`--save-exact` writes `0.33.0`, not `^0.33.0`, so you get the versions this
lesson was checked with.

### 3. A binding for AI

A Worker doesn't hold passwords to reach Cloudflare services. It gets a
**binding**: a named connection that Cloudflare hands your code on `env`.
Add one to `apps/agent/wrangler.jsonc`, after `upload_source_maps` (note
the new comma after `true`):

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="a-04" highlight="4-8" label="apps/agent/wrangler.jsonc"}
	"observability": {
		"enabled": true
	},
	"upload_source_maps": true,
	"ai": {
		"binding": "AI",
		"remote": true
	}
:::

`binding: "AI"` means your code reaches it as `env.AI`. `remote: true`
means that even under `pnpm dev`, model calls go to the real service on your
account, since there's no model on your laptop. Then refresh the types, so
TypeScript knows about `env.AI`:

```sh
pnpm --filter agent run cf-typegen
```

This is why no key lives in the Worker. The binding proves the call comes
from your account. Your Anthropic key, if you add one, is stored in your
gateway, not in your code or your repo.

### 4. Pick the model

Make `apps/agent/src/model.ts`:

:::code{file="apps/agent/src/model.ts" lang="ts" tag="a-04" highlight="5-9" label="apps/agent/src/model.ts"}
import { createAI } from 'agents/models/ai-sdk';

// Every model call goes through your AI Gateway. "default" is created for you on first use.
export function model(env: Env) {
	const ai = createAI({ binding: env.AI, id: 'default' });
	return ai('anthropic/claude-haiku-5.5', {
		// No Anthropic key on your gateway yet? Klippy answers with a free Workers AI model instead.
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}
:::

- `createAI` connects to the AI Gateway called `default` through the
  binding. Cloudflare creates that gateway the first time you use it.
- `anthropic/claude-haiku-5.5` is Claude Haiku 5.5: Anthropic's fast,
  low-cost model, and plenty for Klippy.
- `fallback` is the plan B. If the Claude call fails, the same request goes
  to `@cf/zai-org/glm-4.7-flash`, a free **Workers AI** model that runs on
  Cloudflare. `reasoningEffort: null` turns its thinking step off, for
  short, quick answers.

**The one-line switch.** Claude needs your Anthropic key in your gateway,
and that costs money per call. Without a key, the Claude call fails and the
free model answers instead, so Klippy works either way. To use only the
free model, make line 6 `return ai('@cf/zai-org/glm-4.7-flash', {
reasoningEffort: null });` (and drop the fallback). To use Claude, store
your key, as below.

To store your key: in the Cloudflare dashboard, go to **AI → AI Gateway**,
open the `default` gateway (or create one with that name), find **Provider
Keys**, choose **Add API Key**, pick Anthropic and paste your key from the
Claude Console. That's **BYOK**, bring your own key. Course F covers spend
limits on the gateway.

### 5. The /ask route

`/ask` takes a question as JSON. Anyone could send anything, so check it
first. In `apps/agent/src/index.ts`, add the imports and a length limit at
the top:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-04" label="apps/agent/src/index.ts (top)"}
import { generateText } from 'ai';
import { model } from './model';

// Long questions cost money and time. 2,000 characters is plenty for one question.
const MAX_QUESTION = 2000;
:::

Then add the route under the `/` one, still inside `fetch`. Change
`async fetch(request)` to `async fetch(request, env)` too, since the route
needs `env`. First, the checks:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-04" highlight="2-7" label="apps/agent/src/index.ts"}
		if (url.pathname === '/ask' && request.method === 'POST') {
			// Never trust the body: check that question really is a string before using it.
			const body = await request.json<{ question?: unknown }>().catch(() => null);
			const question = typeof body?.question === 'string' ? body.question.trim() : '';
			if (!question || question.length > MAX_QUESTION) {
				return Response.json({ error: `Send {"question": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
			}
:::

**Never trust the body.** `request.json()` turns the body into an object,
or fails, and `.catch(() => null)` turns a failure into `null`. The type
`{ question?: unknown }` is only a label for TypeScript; it checks nothing
when the code runs. So `typeof body?.question === 'string'` checks for real.
A missing, blank or over-long question gets a `400 Bad Request` and never
reaches the model.

Then the call itself, right after the checks:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-04" highlight="2-9" label="apps/agent/src/index.ts"}

			const { text, providerMetadata } = await generateText({
				model: model(env),
				system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
				messages: [{ role: 'user', content: question }],
				maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
			});
			// Which model answered: Claude, or the fallback.
			return Response.json({ answer: text, model: providerMetadata?.cloudflare?.model });
		}
:::

- `system` is the system prompt: who Klippy is and how long to answer.
- The question goes in as a `user` message, on its own. It's never pasted
  into your system prompt, so a question can't rewrite Klippy's
  instructions as easily.
- `maxOutputTokens: 300` caps the reply. Every call spends your money, and
  a public endpoint can be called by anyone, again and again. That's
  called **denial of wallet**. The cap on the question and the cap on the
  reply bound what one call can cost. Before you deploy, you'll add a lock
  so that only you can call it.
- `providerMetadata.cloudflare.model` says which model answered: Claude or
  the fallback.

### 6. Ask it

With `pnpm dev` running, ask Klippy something:

```sh
curl -s -X POST http://localhost:8787/ask -d '{"question":"Who are you, in one sentence?"}'
```

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -d '{&quot;question&quot;:&quot;Who are you, in one sentence?&quot;}'"}
{"answer":"I'm Klippy, your friendly personal assistant ready to help you with questions and tasks!","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

Look at `model`. **Our recording has no Anthropic key in its gateway, so
the free fallback answered, not Claude.** With your key stored, you'll see
`anthropic/claude-haiku-5.5` there. Every recorded answer in these courses
comes from the fallback, and we label it each time.

Now send something that isn't a question:

:::terminal{cmd="curl -s -i -X POST http://localhost:8801/ask -d '{&quot;question&quot;: 42}'"}
HTTP/1.1 [synapse]400 Bad Request[text]
Content-Length: 63
Content-Type: application/json

{"error":"Send {\"question\": \"...\"}, up to 2000 characters"}
:::

If you get a 500 and the dev log says "Insufficient balance; add money to
your gateway or use BYOK", the fallback line is missing from `model.ts`. If
it says you're not logged in, run step 1 again.

### 7. Test it without spending a cent

Tests shouldn't call a real model: that's slow, costs money and gives a
different answer each time. Klippy's tests swap in a fake model from
`ai/test` that always says the same thing. Copy
[`test/fake-model.ts`](https://github.com/ryanyogan/klippy/blob/a-04/apps/agent/test/fake-model.ts)
and [`test/ask.spec.ts`](https://github.com/ryanyogan/klippy/blob/a-04/apps/agent/test/ask.spec.ts)
from the repo, and add `remoteBindings: false` to `vitest.config.mts`, so
tests never reach your account. Here's the part that checks the refusals:

:::code{file="apps/agent/test/ask.spec.ts" lang="ts" tag="a-04" highlight="1-7" label="apps/agent/test/ask.spec.ts"}
	it.each([
		['no body', ''],
		['no question', '{}'],
		['a question that is not a string', '{"question": 42}'],
		['a blank question', '{"question": "   "}'],
		['a question over 2,000 characters', JSON.stringify({ question: 'a'.repeat(2001) })],
	])('refuses %s with a 400', async (_name, body) => {
		const response = await ask(body);
		expect(response.status).toBe(400);
	});
:::

`it.each` runs the same test once per row: five bad bodies, five 400s. The
other test checks that the reply cap really reaches the model call.

:::terminal{cmd="pnpm test"}
 Test Files  [volt]2 passed[text] (2)
      Tests  [volt]8 passed[text] (8)
:::

:::quiz{id="no-key-in-worker" xp=20}
Klippy calls Claude, but there's no Anthropic key anywhere in its code. How?

- [ ] Claude Haiku 5.5 is free, so it needs no key
  Not quite. Claude calls are paid. Without a key, our recording fell back to a free Workers AI model.
- [x] The AI binding proves the call is from your account, and your key is stored in your gateway
  Right. The Worker gets a binding, the gateway holds the key. Nothing secret lives in your repo.
- [ ] The key is in wrangler.jsonc
  Not quite. wrangler.jsonc is committed to git. A key there would be public the moment you pushed.
:::

Commit your work. Stuck? Compare with tag `a-04`
([changes from a-03](https://github.com/ryanyogan/klippy/compare/a-03...a-04)).

:::rabbithole
- read "BYOK: store your provider keys" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/"
- read "Bindings" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/"
- read "Models overview" by="Anthropic" url="https://platform.claude.com/docs/en/about-claude/models/overview"
:::
