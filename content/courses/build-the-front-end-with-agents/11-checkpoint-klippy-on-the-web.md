---
# sources (checked 2026-11-03):
# - Cloudflare Workers, Rate Limiting binding https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
# - Cloudflare Workers, Secrets https://developers.cloudflare.com/workers/configuration/secrets/
# - Klippy d-10 → d-11, docs/outputs/d-11.txt (2026-11-03). The code was written by an agent against the prompt, not
#   recorded from a fresh run. The local checks and dry runs are real; the live deploy is not recorded, and the
#   lesson says so. The probe answer came from the Workers AI fallback.
title: "Checkpoint: Klippy on the web"
order: 11
minutes: 25
xp: 120
module: Review and ship
device: desk
tag: d-10
verified: 2026-11-03
versions:
  remix: "3.1.0"
  agents: "0.33.0"
  wrangler: "4.157.0"
---

Klippy has a web app: GitHub sign-in, your notes, and a live chat with
Approve and Deny. One last prompt makes it gradeable, then you ship both
Workers and let bits check them.

### 1. The prompt

bits will call your **web app's** `/klippy/check`, which answers through
the agent. That proves both Workers and the binding between them.

```text
Goal: get Klippy's web app ready to deploy and gradeable: a public /klippy/check on the web app that answers through
the agent, so bits can prove both Workers and the binding between them work.
Use the remix skill (routes, controllers, data-schema) and the cloudflare skill for the Rate Limiting binding.
Constraints:
- GET /klippy/check?nonce= in its own controller, no sign-in. Validate nonce with data-schema (8–64 of A-Z a-z 0-9 _ -).
- Rate limit it per address with a new binding (10 a minute); forward to the agent's /klippy/check with agentFetch.
- Set TAG to 'd-11' in apps/agent/src/check.ts and its test. Don't deploy anything.
Plan first, then wait for my go-ahead.
Done when typecheck, tests and remix doctor pass, both `wrangler deploy --dry-run`s build, and the local check
returns the nonce and tag d-11. Report the files and outputs, then list the deploy steps for me to run.
```

- **Its own controller, no sign-in.** The grader isn't signed in. Every
  other page stays behind `requireUser`.
- **Rate limited, forwarded.** The agent's check already caches its probe
  for five minutes; the web route adds a limit per address in front.
- **"Don't deploy anything."** Deploying is yours to do.

### 2. What to expect

A new controller, a schema for the nonce, a route, and a rate-limit binding:

:::code{file="apps/web/app/actions/check/controller.tsx" lang="ts" tag="d-11" highlight="6-9" label="apps/web/app/actions/check/controller.tsx"}
export default createController(routes.check, {
	actions: {
		async index(context) {
			const query = parseSafe(CheckQuery, context.url.searchParams);
			if (!query.success) return Response.json({ error: 'Send ?nonce= (8 to 64 letters, digits, - or _)' }, { status: 400 });
			const address = context.request.headers.get('cf-connecting-ip') ?? 'local';
			if (!(await env.CHECK_LIMITER.limit({ key: address })).success) {
				return Response.json({ error: 'Too many checks. Wait a minute.' }, { status: 429 });
			}
			// Through the service binding, as everything else: proof the web app really reaches your agent.
			const reply = await agentFetch(`/klippy/check?nonce=${query.value.nonce}`);
			return new Response(reply.body, {
				status: reply.status,
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
			});
		},
	},
});
:::

Our local checks (real; the Workers AI fallback answered the probe, and
the probe says so):

:::terminal{cmd="curl -i &quot;localhost:8802/klippy/check?nonce=bits-d11-check&quot;"}
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
{"nonce":"bits-d11-check",[volt]"tag":"d-11"[text],"probe":{"answer":"Hi bits!","model":"@cf/zai-org/glm-4.7-flash"}}
:::

A bad or missing nonce gets a 400 before any call to the agent. Of ten more
calls in a minute, the tenth got a 429. Signed out, `/` still redirects to
`/login`. All tests pass: the agent's 64, the web app's 3 and the driver's
24.

### 3. Review it

- The check controller has no `requireUser`, and nothing else became
  public.
- A bad nonce is a 400 before any call to the agent; the 11th call in a
  minute is a 429.
- JSON with `Cache-Control: no-store`; the agent's body passes through.
- No secret, account id or real GitHub id in `wrangler.jsonc`.
- **Reject**: a probe that calls the model from the web app, a check that
  writes anything, `wrangler deploy` run by the agent.

Steer prompts:

```text
You put /klippy/check inside the root controller, which has requireUser, so the grader gets a 302. Give it its own controller without it.
```

```text
Don't run wrangler deploy. List the steps and I'll run them.
```

### 4. Ship both Workers

**What we recorded, and what we didn't.** We haven't deployed the reference
web app, so there's no recorded live deploy or live sign-in. Here are the
steps, in order:

1. **A GitHub OAuth app** for the live site: Homepage
   `https://klippy-web.<your-subdomain>.workers.dev`, callback
   `https://klippy-web.<your-subdomain>.workers.dev/auth/github/callback`.
2. In `apps/web/wrangler.jsonc`, set `APP_ORIGIN` to that address and
   `ALLOWED_GITHUB_IDS` to your id (`gh api user --jq .id`).
3. **The agent first** (the web app binds to it). From `klippy/`:
   `pnpm deploy`. Its token and database are already set from earlier
   courses.
4. **The web app's secrets**, in `apps/web`, one at a time:

```sh
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put KLIPPY_TOKEN
```

`SESSION_SECRET` is a new random value (`openssl rand -base64 32`);
`KLIPPY_TOKEN` is the same value the agent has.

Last, from `klippy/`: `pnpm deploy:web`. Then sign in, send a message,
approve a `saveNote`, and find the note on `/notes`.

Our dry runs show both build: the agent at 3,684 KiB (713 KiB gzip), the
web app at 986 KiB (197 KiB gzip).

### 5. Let bits check it

Paste your **web app's** address. bits calls `/klippy/check` on it and
looks for this checkpoint's tag.

:::verify{id="klippy-on-the-web" path="/klippy/check?nonce=bits-checkpoint-d11" xp=60}
Paste the https://klippy-web….workers.dev address that `pnpm deploy:web` printed.
- goal "Your Klippy web app is live: its /klippy/check answers through the agent with bits' nonce and tag d-11 (or a later one)"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-d11"/
- expect "Is at d-11 or later" match /"tag"\s?:\s?"(d-11|[e-g]-\d\d)"/
- hint "Open /klippy/check?nonce=hello-from-me on your web app's address. Does it say \"tag\":\"d-11\"?"
- hint for="Is at d-11 or later" "Set TAG = 'd-11' in apps/agent/src/check.ts, then deploy the agent again: the web app answers with the agent's tag."
- hint for="Answers the check" "A 302 means the check sits behind sign-in: give it its own controller. A 429 means too many checks: wait a minute. A 5xx can mean the binding or the agent's token is wrong: run wrangler tail on both."
:::

A pass proves a web app at that address reaches an agent that answers the
way this course asks. It doesn't prove who wrote it.

:::quiz{id="front-end-ideas" xp=20}
Which of these is your job, not the coding agent's?

- [ ] Typing the controller code
  Not quite. That's what you directed it to do.
- [x] The brief, the constraints, reading the diff, and deciding what ships
  Right. The agent writes; you decide what it should write and whether to keep it.
- [ ] Remembering Remix 3's APIs
  Not quite. The skill and the installed docs do that, for both of you.
:::

That's Klippy on the web, built by directing an agent. Your code matches
tag `d-11`
([changes from d-10](https://github.com/ryanyogan/klippy/compare/d-10...d-11)).
Next, Klippy learns to answer from your own documents.

:::rabbithole
- read "Rate Limiting" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/"
- read "Secrets" by="Cloudflare" url="https://developers.cloudflare.com/workers/configuration/secrets/"
:::
