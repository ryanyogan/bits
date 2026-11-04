---
# sources (checked 2026-11-03):
# - Cloudflare AI Gateway, Caching (off by default; cf-aig-cache-ttl sets the lifetime "for a request
#   that already uses caching"; cf-aig-cache-key opts one request in; TTL 60 s to one month; the
#   default key is an exact match of the whole request)
#   https://developers.cloudflare.com/ai-gateway/features/caching/
# - Cloudflare AI Gateway, Custom metadata (labels on each logged request)
#   https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/
# - Cloudflare AI Gateway, Spend limits (cost budgets that block requests once spent, scoped by model,
#   provider or custom metadata, split by value; Settings > Spend limits; over budget = 429 before
#   the provider is called; changelog 2026-06-05)
#   https://developers.cloudflare.com/ai-gateway/features/spend-limits/
# - agents 0.33.0, installed docs/models.md "Options" (createAI: metadata, cacheKey, cacheTtl)
# - Klippy f-01 → f-02, recorded output docs/outputs/f-02.txt (2026-11-03). Every probe answer came
#   from the Workers AI fallback (@cf/zai-org/glm-4.7-flash): there's no Anthropic key on the recording
#   gateway. The cache HIT is real. Spend limits were not set on the recording account.
title: "The gateway earns its keep"
order: 2
minutes: 20
xp: 50
module: Lock it down
device: desk
tag: f-01
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  wrangler: "4.157.0"
---

Every model call Klippy makes already goes through your AI Gateway,
`default`, since course A. So far it only routes and falls back. In this
lesson it starts to earn its keep: it labels each call, so you can see who
spent what, and it caches the one answer that's the same for everyone.

### 1. Label every call

`model()` now takes a `Call`: which part of Klippy is asking, and whose
Klippy it is. One `gateway()` helper puts that on every request:

:::code{file="apps/agent/src/model.ts" lang="ts" tag="f-02" highlight="12-14" label="apps/agent/src/model.ts"}
// What each call is for, so the gateway can label it (f-02). route: which part of Klippy asked; user: whose Klippy.
// cache: only for a request that's the same for everyone (the check probe). Chats are personal and change: never cached.
export type Call = { route: 'ask' | 'note' | 'chat' | 'check' | 'context'; user?: string; cache?: { key: string; ttl: number } };

// Every model call goes through your AI Gateway. "default" is created for you on first use.
function gateway(env: Env, { route, user, cache }: Call) {
	return createAI({
		binding: env.AI,
		id: 'default',
		// Shown on each request in the gateway's logs, and what spend limits can be scoped by (say, per user per day).
		// Labels only: never the question, a note or a token.
		metadata: { app: 'klippy', route, user: user ?? null },
		// Caching is off unless a request opts in: cacheKey opts in, cacheTtl says for how long (60 s minimum).
		...(cache ? { cacheKey: cache.key, cacheTtl: cache.ttl } : {}),
	});
}
:::

The `metadata` shows on each request in the gateway's logs. It also scopes
**spend limits**: a dollar budget per model, provider or metadata value that
blocks requests once it's spent. So a `user` label is what a per-user daily
limit keys on. Claude and the fallback get the same labels, because a
fallback model inherits the options of the chain it's part of.

Labels only: never the question, a note or a token. Note that the gateway's
own log keeps each prompt and reply by default. For a personal Klippy
that's your own data in your own account, but know it's there.

A chat turn says whose Klippy is talking (`gh-<id>` from the web app):

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-02" label="apps/agent/src/agent.ts"}
			model: model(this.env, { route: 'chat', user: this.name }), // labelled with whose Klippy it is, in the gateway's logs
:::

`/ask` passes `route: 'ask'`, the note tidier `route: 'note'`, and the
ingest step that writes context `route: 'context'`.

### 2. Caching needs a key

The obvious way to cache is `createAI({ cacheTtl: 300 })`. On a new gateway,
**that caches nothing.** AI Gateway's caching is off unless you turn it on,
and `cacheTtl` only sets how long a cached answer lives **for a request that
already uses caching**. What opts one request in is `cacheKey`. So Klippy
sets both, and only for the check probe:

:::code{file="apps/agent/src/check.ts" lang="ts" tag="f-02" highlight="3" label="apps/agent/src/check.ts"}
		// The probe is the same for every caller, so the gateway may cache it too (f-02): a fresh isolate, or another
		// datacenter, gets the cached answer for 5 minutes instead of a new model call. The key names the tag.
		const probe = await ask(env, 'Say hello to bits in one short sentence.', {}, { route: 'check', cache: { key: `klippy-check-${TAG}`, ttl: 300 } });
:::

Why only the probe? It's the same question for every caller, so a fresh
isolate or another datacenter can reuse the answer for five minutes instead
of a new model call. A chat is personal and changes by the minute (the
time, your notes). With a wrong key, a cached chat reply could answer one
person with another's words. **Cache only what's the same for everyone**,
and put the tag in the key, so a new version never serves an old answer.

`ask()` returns the gateway's cache status too:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="f-02" label="apps/agent/src/ask.ts"}
	// cache: HIT when the gateway answered from its cache (only requests that opt in, like the check probe).
	return { answer, model: providerMetadata?.cloudflare?.model, cache: providerMetadata?.cloudflare?.cacheStatus };
:::

Copy [`test/gateway.spec.ts`](https://github.com/ryanyogan/klippy/blob/f-02/apps/agent/test/gateway.spec.ts).
It swaps `env.AI` for a stand-in that records what it's asked, and checks
that a chat carries its labels on both legs and no cache key, while the
probe carries `cacheKey` and `cacheTtl`. No model or network is called.
Ours: 22 test files, 98 tests passed.

### 3. Watch it hit

Three calls to the check, on `wrangler dev` (the Workers AI fallback
answered, not Claude):

:::terminal{cmd="curl -s 'localhost:8801/klippy/check?nonce=f02-first'"}
{"nonce":"f02-first","tag":"e-09","probe":{"answer":"Hello, little bits!","model":"@cf/zai-org/glm-4.7-flash",[volt]"cache":"MISS"[text]}}
:::

Calling it again on the same server says `MISS` too, but makes no model
call: the module's own five-minute cache answered. Then we stopped the
server and started a new one, with an empty module cache:

:::terminal{cmd="curl -s 'localhost:8801/klippy/check?nonce=f02-fresh'"}
{"nonce":"f02-fresh","tag":"e-09","probe":{"answer":"Hello, little bits!","model":"@cf/zai-org/glm-4.7-flash",[volt]"cache":"HIT"[text]}}
:::

The same words, from the gateway's cache. (The tag still says `e-09`: it
changes at the checkpoint.)

### 4. Set a spend limit

This one is in the dashboard, not the code: select the `default` gateway,
then **Settings → Spend limits.** A rule is a dollar budget over a time
window. Before each request, the gateway checks every rule, and once one is
spent it answers 429 instead of calling the provider. Add one for the whole
gateway, and one by the `user` metadata, split by value, so each Klippy
gets its own budget. Budget alerts under Billing also email you, but they
fire the next day, so they're no brake. We haven't set limits on
the recording account. Do it before you deploy.

:::quiz{id="gateway-cache" xp=20}
You add createAI({ cacheTtl: 300 }) to a fresh gateway and call the same prompt twice. What happens?

- [ ] The second call is a cache hit for 5 minutes
  Not quite. cacheTtl alone only sets the lifetime of a request that already uses caching.
- [x] Both calls go to the model: nothing opted the request into caching
  Right. cacheKey opts it in (or caching turned on in the gateway's settings).
- [ ] The gateway caches every user's chats for 5 minutes
  Not quite. And that's the outcome to avoid: chats are personal.
:::

Your code matches tag `f-02`
([changes from f-01](https://github.com/ryanyogan/klippy/compare/f-01...f-02)).

:::rabbithole
- read "AI Gateway caching" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/features/caching/"
- read "Spend limits" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/features/spend-limits/"
:::
