---
# sources (checked 2026-11-03):
# - Cloudflare Workers, Secrets (wrangler secret put, .dev.vars) https://developers.cloudflare.com/workers/configuration/secrets/
# - Cloudflare Workers, Rate Limiting binding (per-location, approximate counters)
#   https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
# - Cloudflare Workers, Web Crypto timingSafeEqual https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
# - Cloudflare Workers, Observability: logs and traces (traces count toward Observability pricing from
#   2026-12-01) https://developers.cloudflare.com/workers/observability/traces/
# - Cloudflare Workers, Rollbacks https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
# - Cloudflare AI Gateway, spend limits https://developers.cloudflare.com/ai-gateway/features/spend-limits/
# - Workers best practices https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
# - Klippy a-04 → a-05, recorded output docs/outputs/a-05.txt (2026-11-03). Local runs are recorded;
#   the live deploy is not (only `wrangler deploy --dry-run`), and the lesson says so. Answers came from
#   the Workers AI fallback.
title: "Checkpoint: ship it"
order: 5
minutes: 30
xp: 100
module: Ship it
device: desk
tag: a-04
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
  agents: "0.33.0"
  ai: "7.0.162"
---

Time to put Klippy on the internet. But first, think about what deploying
means: `/ask` becomes a public address, and every call to it spends **your**
model budget. Anyone who finds it could call it all day. So before the
first deploy, you'll add two locks. Then you'll ship, and bits will call your
Worker to check that it's live.

### 1. Lock one: only you

`/ask` will need a header, `Authorization: Bearer <token>`, where the token
is a long random string only you know. Make `apps/agent/src/guard.ts`:

:::code{file="apps/agent/src/guard.ts" lang="ts" tag="a-05" highlight="4-9" label="apps/agent/src/guard.ts"}
// Two locks for a public Worker that spends your own model budget.

// 1. Only you: /ask needs "Authorization: Bearer <KLIPPY_TOKEN>". The token is a Worker secret.
export async function isOwner(request: Request, env: Env) {
	if (!env.KLIPPY_TOKEN) return false; // no token set: the door stays shut
	const sent = request.headers.get('Authorization') ?? '';
	const [a, b] = await Promise.all([sha256(sent), sha256(`Bearer ${env.KLIPPY_TOKEN}`)]);
	return crypto.subtle.timingSafeEqual(a, b); // compare in constant time, so timing leaks nothing
}
// ...
async function sha256(text: string) {
	return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}
:::

- `env.KLIPPY_TOKEN` is a **secret**: a value Cloudflare stores for your
  Worker and hands it on `env`, like a binding. It's never in your code.
- No token set? `isOwner` says no. A missing secret should lock the door,
  not open it.
- Why hash both sides and use `timingSafeEqual`, instead of `===`? A plain
  comparison stops at the first wrong character, so a wrong guess that
  starts right takes a tiny bit longer. Over many tries, that timing can leak
  the token. Hashing makes both values the same length, and
  `timingSafeEqual` takes the same time whatever they hold.

### 2. Lock two: not too often

Even you shouldn't be able to make a thousand calls a minute by accident.
Add this to `guard.ts`, between `isOwner` and `sha256`:

:::code{file="apps/agent/src/guard.ts" lang="ts" tag="a-05" highlight="2-9" label="apps/agent/src/guard.ts"}
// 2. Not too often: at most 10 model calls a minute per key (an address, or one shared name).
export async function underLimit(env: Env, key: string) {
	const { success } = await env.LIMITER.limit({ key });
	return success;
}

// The caller's address, as Cloudflare saw it ("local" in tests and some dev setups).
export function clientAddress(request: Request) {
	return request.headers.get('cf-connecting-ip') ?? 'local';
}
:::

`env.LIMITER` is Cloudflare's **Rate Limiting** binding. `limit({ key })`
counts calls per key and says whether this one is allowed. On `/ask` the
key is the caller's address. Declare the binding, and the secret, in
`wrangler.jsonc` after the `ai` block:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="a-05" highlight="4-8" label="apps/agent/wrangler.jsonc"}
	"ai": {
		"binding": "AI",
		"remote": true
	},
	// Secrets the Worker needs. Set them with `wrangler secret put KLIPPY_TOKEN`, and locally in .dev.vars.
	"secrets": { "required": ["KLIPPY_TOKEN"] },
	// At most 10 calls per minute per key. namespace_id is any number, unique in your account.
	"ratelimits": [{ "name": "LIMITER", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }]
:::

- `secrets.required` tells wrangler the Worker needs `KLIPPY_TOKEN`:
  `wrangler types` types it, and `wrangler dev` warns when it's missing.
- The limiter allows 10 calls per 60 seconds per key. `namespace_id` is any
  number you choose, unique in your account.

Be honest with yourself about what this is. The limiter's counts are kept
per Cloudflare location and are approximate. It's a **brake, not a bill
cap**. The real cap on spending lives at your AI Gateway, which can set
rate limits and spend limits per gateway. Course F sets them up.

### 3. One ask() for every route

Two routes are about to ask the model the same way, so move the call into
its own file. Make `apps/agent/src/ask.ts` (the body is the call you wrote
last lesson):

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="a-05" highlight="8-16" label="apps/agent/src/ask.ts"}
import { generateText } from 'ai';
import { model } from './model';

// Long questions cost money and time. 2,000 characters is plenty for one question.
export const MAX_QUESTION = 2000;

// One question in, one answer out. Both /ask and /klippy/check use it.
export async function ask(env: Env, question: string) {
	const { text, providerMetadata } = await generateText({
		model: model(env),
		system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
		messages: [{ role: 'user', content: question }],
		maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
	});
	// Which model answered: Claude, or the fallback.
	return { answer: text, model: providerMetadata?.cloudflare?.model };
}
:::

Then `/ask` in `index.ts` checks both locks before anything else:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-05" highlight="2-7" label="apps/agent/src/index.ts"}
		if (url.pathname === '/ask' && request.method === 'POST') {
			if (!(await isOwner(request, env))) {
				return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
			}
			if (!(await underLimit(env, clientAddress(request)))) {
				return Response.json({ error: 'Too many questions. Wait a minute.' }, { status: 429 });
			}
			// Never trust the body: check that question really is a string before using it.
			const body = await request.json<{ question?: unknown }>().catch(() => null);
			const question = typeof body?.question === 'string' ? body.question.trim() : '';
			if (!question || question.length > MAX_QUESTION) {
				return Response.json({ error: `Send {"question": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
			}
			return Response.json(await ask(env, question));
		}
:::

The order matters: the cheap checks (token, limit, body) run before the
expensive one (the model). A caller without the token never costs you a
model call. Update the imports at the top of `index.ts` to
`import { ask, MAX_QUESTION } from './ask';` and
`import { clientAddress, isOwner, underLimit } from './guard';`, and delete
the old `generateText` and `model` imports.

### 4. Your token, locally

Locally, secrets live in `apps/agent/.dev.vars`, which `.gitignore` keeps
out of git. Make a token and put it there:

```sh
openssl rand -hex 32
```

Copy the output, and write it in `apps/agent/.dev.vars` as
`KLIPPY_TOKEN=` followed by your token. (Klippy's repo has a
`.dev.vars.example` with a placeholder.) Then run
`pnpm --filter agent run cf-typegen`, so `env.KLIPPY_TOKEN` and
`env.LIMITER` are typed.

### 5. A door for bits

bits checks your deploy by calling one address on it: `GET
/klippy/check?nonce=…`. It must stay public, since bits has no token. But
anyone else can call it too, so it must never cost more than a few model
calls, however often it's called. Make `apps/agent/src/check.ts`:

:::code{file="apps/agent/src/check.ts" lang="ts" tag="a-05" highlight="15-27" label="apps/agent/src/check.ts"}
import { ask } from './ask';
import { underLimit } from './guard';

// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'a-05';

const NONCE = /^[A-Za-z0-9_-]{8,64}$/;
const FIVE_MINUTES = 5 * 60 * 1000;

// The probe answer is the same for every caller, so ask the model at most once every five minutes.
let cached: { probe: Awaited<ReturnType<typeof ask>>; at: number } | undefined;

// GET /klippy/check?nonce=...: bits calls this to check that your Klippy is live.
// Anyone can call it, so it must never spend more than a few model calls, whoever asks.
export async function check(url: URL, env: Env) {
	const nonce = url.searchParams.get('nonce') ?? '';
	if (!NONCE.test(nonce)) {
		return Response.json({ error: 'Send ?nonce= (8 to 64 letters, digits, - or _)' }, { status: 400 });
	}
	if (!cached || Date.now() - cached.at > FIVE_MINUTES) {
		// One shared key for everyone: at most 10 fresh probes a minute in total.
		if (!(await underLimit(env, 'check'))) {
			return Response.json({ error: 'Too many checks. Wait a minute.' }, { status: 429 });
		}
		cached = { probe: await ask(env, 'Say hello to bits in one short sentence.'), at: Date.now() };
	}
	return Response.json({ nonce, tag: TAG, probe: cached.probe }, { headers: { 'Cache-Control': 'no-store' } });
}
:::

- The **nonce** is a random word bits sends, so it knows the answer is
  fresh. Only 8 to 64 letters, digits, `-` or `_` are accepted, so the route
  never echoes back whatever someone types.
- The **probe** asks the model a fixed question. Its answer is the same for
  everyone, so it's kept for five minutes in `cached`: a hundred checks in a
  minute cost one model call.
- `cached` lives in one copy of your Worker, and Cloudflare may run several.
  So a fresh probe also needs the limiter, under one shared key, `'check'`:
  at most 10 fresh probes a minute in total, whoever asks.
- `TAG` says which lesson your code is at. You'll change it at the end of
  each course. `Cache-Control: no-store` stops anything in between from
  keeping an old answer.

Route it in `index.ts`, after `/ask`, and add
`import { check } from './check';` at the top:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="a-05" label="apps/agent/src/index.ts"}
		if (url.pathname === '/klippy/check' && request.method === 'GET') {
			return check(url, env);
		}
:::

### 6. See it run

Last, turn on logs and **traces** (a timeline of each request, including the
call to AI Gateway), so you can see what your live Worker does. Replace the
`observability` block in `wrangler.jsonc`:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="a-05" highlight="3-6" label="apps/agent/wrangler.jsonc"}
	"observability": {
		"enabled": true,
		// Logs: every console.log and request, searchable in the dashboard for 7 days.
		"logs": { "enabled": true },
		// Traces: a timeline of each request, including the call to AI Gateway.
		"traces": { "enabled": true }
	},
:::

Traces start counting toward Cloudflare's Observability pricing on 1
December 2026; the free allowance covers a learning project.

Now restart `pnpm dev` and try every door. Use your own token in place of
ours:

:::terminal{cmd="curl -s -i -X POST http://localhost:8801/ask -d '{&quot;question&quot;:&quot;Hi&quot;}'"}
HTTP/1.1 [synapse]401 Unauthorized[text]
Content-Length: 58
Content-Type: application/json

{"error":"Send Authorization: Bearer <your KLIPPY_TOKEN>"}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;Who are you, in one sentence?&quot;}'"}
{"answer":"I am Klippy, a friendly personal assistant here to help you quickly and efficiently.","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

:::terminal{cmd="curl -s &quot;http://localhost:8801/klippy/check?nonce=lesson-a05-demo&quot;"}
{"nonce":"lesson-a05-demo","tag":"a-05","probe":{"answer":"Hello to bits!","model":"@cf/zai-org/glm-4.7-flash"}}
:::

:::terminal{cmd="curl -s &quot;http://localhost:8801/klippy/check?nonce=second-call-same-probe&quot;"}
{"nonce":"second-call-same-probe","tag":"a-05","probe":{"answer":"Hello to bits!","model":"@cf/zai-org/glm-4.7-flash"}}
:::

The second check took 7 milliseconds in our dev log, against 2.3 seconds for
the first: same probe, from the cache, with the new nonce. The answers came
from the free fallback model, as in the last lesson.

Now the tests. `/ask` needs a token now, so last lesson's tests would all get
a 401. Give the tests a known token of their own in
`apps/agent/vitest.config.mts`:

:::code{file="apps/agent/vitest.config.mts" lang="ts" tag="a-05" highlight="4-5" label="apps/agent/vitest.config.mts"}
			wrangler: { configPath: "./wrangler.jsonc" },
			// Tests never call real models: they stay offline and free.
			remoteBindings: false,
			// A known token for tests (your real one lives in .dev.vars and in Cloudflare's secrets).
			miniflare: { bindings: { KLIPPY_TOKEN: "test-token" } },
:::

Then copy the updated `test/ask.spec.ts` and the new
[`test/check.spec.ts`](https://github.com/ryanyogan/klippy/blob/a-05/apps/agent/test/check.spec.ts)
from the repo at tag `a-05` (the simplest way: copy the whole
`apps/agent/test/` folder). They send that token, test both locks, and
prove two checks make one model call. Run `pnpm test`. Ours: 14 passed.

If every `/ask` says 401, check that `.dev.vars` is in `apps/agent`, not
the root, and restart `pnpm dev`: secrets are read at start.

### 7. Ship it

Set the same token on Cloudflare (it asks you to paste it), then deploy.
From `klippy/`:

```sh
pnpm --filter agent exec wrangler secret put KLIPPY_TOKEN
pnpm deploy
```

`pnpm deploy` prints your Worker's address, like
`https://klippy.<your-subdomain>.workers.dev`. Open
`/klippy/check?nonce=hello-from-me` on it in your browser and you'll see
your own check.

**What we recorded, and what we didn't.** We haven't deployed the reference
Klippy for this lesson, so there's no recorded output of a live deploy here.
This is our dry run, which builds everything and stops before uploading:

:::terminal{cmd="pnpm --filter agent exec wrangler deploy --dry-run"}
Total Upload: 818.90 KiB / gzip: 161.95 KiB
Your Worker has access to the following bindings:
Binding                            Resource
env.AI                             AI
env.LIMITER (10 requests/60s)      Rate Limit

--dry-run: exiting now.
:::

Two more commands worth knowing. `pnpm --filter agent exec wrangler tail`
streams your live Worker's logs to the terminal while you send it requests.
And every deploy is a new **version**: `wrangler deployments list` shows
them, and `wrangler rollback` puts the previous one back in seconds if a
deploy goes wrong.

### 8. Let bits check it

Paste your Worker's address below. bits calls `/klippy/check` on it from
its own server and checks the reply.

:::verify{id="klippy-live" path="/klippy/check?nonce=bits-checkpoint-a05" xp=60}
Paste the https://….workers.dev address that `pnpm deploy` printed.
- goal "Your Klippy is live: /klippy/check answers with the nonce, its tag and a probe answer"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-a05"/
- expect "Says which lesson it's at" match /"tag"\s?:\s?"[a-g]-\d\d"/
- hint "Open /klippy/check?nonce=hello-from-me on your address in a browser. If that fails, run pnpm deploy again and read its output."
- hint for="Echoes bits' nonce" "Return the nonce from the URL in your JSON, as check.ts does: Response.json({ nonce, tag: TAG, probe })."
- hint for="Answers the check" "A 429 means the check was called too often: wait a minute. A 404 means the route isn't in index.ts, or you deployed before adding it."
:::

A pass proves a Worker at that address answers the way this lesson asks. It
doesn't prove who wrote it: the check isn't anti-cheat, it's a finish line.

:::quiz{id="why-lock-first" xp=20}
Why did Klippy get its locks before its first deploy, not after?

- [ ] Cloudflare refuses to deploy a Worker without a token
  Not quite. Cloudflare will deploy anything. Locking it is your job.
- [x] From the first deploy, anyone can call /ask, and every call spends your model budget
  Right. A token keeps strangers out, the limiter brakes runaway calls, and the check route caches its one model call.
- [ ] Locks make the Worker faster
  Not quite. They add a little work to each request. They're there to protect your bill.
:::

That's Klippy v0: live, locked, logged and checked. Your code matches tag
`a-05` ([changes from a-04](https://github.com/ryanyogan/klippy/compare/a-04...a-05)).
Next course, Klippy gets tools: the weather, the time, notes and links.

:::rabbithole
- read "Workers best practices" by="Cloudflare" url="https://developers.cloudflare.com/workers/best-practices/workers-best-practices/"
- read "Rate Limiting binding" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/"
- read "AI Gateway spend limits" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/features/spend-limits/"
:::
