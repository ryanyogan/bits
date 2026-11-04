---
# sources (checked 2026-11-03):
# - Cloudflare Workers, Rate Limiting binding (period 10 or 60 s; limits are approximate and per
#   Cloudflare location; key on a user or API key, not an IP; for an exact limit use a Durable Object;
#   docs updated 2026-10-21)
#   https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
# - Cloudflare Agents, State and SQL (each agent instance has its own SQLite: this.sql)
#   https://developers.cloudflare.com/agents/agent-class/state/
# - Klippy f-02 → f-03, recorded output docs/outputs/f-03.txt (2026-11-03): the 429 burst on 8802 and
#   the budget-500 chat on 8801. The chat reply is the Workers AI fallback (glm-4.7-flash), not Claude.
#   f-03's budget charges only in onFinish; the lead's security review found the hole, fixed forward in
#   f-04 and again in f-05. This page says so and points ahead.
title: "Limits that hold"
order: 3
minutes: 25
xp: 60
module: Lock it down
device: desk
tag: f-02
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  wrangler: "4.157.0"
---

The agent already has limits: 10 chat turns a minute per Klippy, 8 steps a
turn, 300 tokens a reply. They stop one runaway turn. They don't stop
someone, or a stuck script, sending turns all day. This lesson adds two
limits that do, and each does a different job:

- a **rate limit** per user on the web app, which stops bursts;
- a **daily token budget** in each Klippy, which caps what a day can cost.

### 1. A rate limit keyed on who you are

Cloudflare's Rate Limiting binding counts calls per key over 10 or 60
seconds. Add one to the web app:

:::code{file="apps/web/wrangler.jsonc" lang="json" tag="f-03" highlight="3-5" label="apps/web/wrangler.jsonc"}
	"ratelimits": [
		{ "name": "CHECK_LIMITER", "namespace_id": "1002", "simple": { "limit": 10, "period": 60 } },
		// Signed-in routes that reach your agent: at most 30 a minute per GitHub account (f-03). Keyed by who you are, not
		// your address: many people can share one address, and one person can have many.
		{ "name": "USER_LIMITER", "namespace_id": "1003", "simple": { "limit": 30, "period": 60 } }
	],
:::

Then key it on the GitHub account, never the address:

:::code{file="apps/web/app/limits.ts" lang="ts" tag="f-03" highlight="4" label="apps/web/app/limits.ts"}
// Per-user rate limit for the routes that reach your agent (f-03). Cloudflare's limit is approximate and per location:
// it stops bursts. The exact limit on spending is the agent's daily token budget, kept in its own SQLite.
export async function underUserLimit(user: User) {
	const { success } = await env.USER_LIMITER.limit({ key: `gh-${user.id}` });
	return success;
}

export const tooMany = () => new Response('Too many requests. Wait a minute.', { status: 429 });
:::

Many people can share one address (an office, a phone network), and one
person can have many. Who you are is the key that's fair. The public
`/klippy/check` has no user to key on, so it stays limited by address.

Call `underUserLimit` at the top of the upload, the search, and each new
chat socket. Copy [`limits.ts`](https://github.com/ryanyogan/klippy/blob/f-03/apps/web/app/limits.ts)
and the three calls in
[`sources/controller.tsx`](https://github.com/ryanyogan/klippy/blob/f-03/apps/web/app/actions/sources/controller.tsx)
and [`actions/controller.tsx`](https://github.com/ryanyogan/klippy/blob/f-03/apps/web/app/actions/controller.tsx),
then run `pnpm run cf-typegen` in `apps/web`.

Know what this limit is. Cloudflare's docs say it's **approximate and per
location**: counts sync between datacenters, so requests can get past it
for a moment. It stops bursts. It's not a bill.

### 2. An exact daily budget

For an exact limit, Cloudflare points to a Durable Object, and each Klippy
already is one, with its own SQLite. One Klippy, one writer, wherever the
request came from, so the count can't drift. Set the budget as a var:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="f-03" highlight="3" label="apps/agent/wrangler.jsonc"}
	"vars": {
		// Tokens each Klippy may spend per day (UTC), checked before every chat turn (f-03). About 50 short turns.
		"DAILY_TOKEN_BUDGET": "200000"
	},
:::

And keep a day's total in a table:

:::code{file="apps/agent/src/budget.ts" lang="ts" tag="f-03" highlight="14-17" label="apps/agent/src/budget.ts"}
// A daily token budget per Klippy (f-03). The rate limit stops bursts; this stops a slow drip from running up a bill.
// It lives in the agent's own SQLite, so it's exact: one Klippy, one writer, wherever the request came from.

const today = () => new Date().toISOString().slice(0, 10); // the day, in UTC

// Tokens (input + output, every step) this Klippy has spent today.
export function tokensToday(agent: Klippy) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	const [row] = agent.sql<{ tokens: number }>`SELECT tokens FROM usage WHERE day = ${today()}`;
	return row?.tokens ?? 0;
}

// Add a finished turn's tokens to today's total.
export function spend(agent: Klippy, tokens: number) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	agent.sql`INSERT INTO usage (day, tokens) VALUES (${today()}, ${tokens})
		ON CONFLICT (day) DO UPDATE SET tokens = tokens + ${tokens}`;
}

// The budget comes from a var in wrangler.jsonc, so you can change it without touching code.
export function dailyBudget(env: Pick<Env, 'DAILY_TOKEN_BUDGET'>) {
	return Number(env.DAILY_TOKEN_BUDGET) || 0;
}
:::

Check it **before** the model is called, so a turn that can't afford it
never starts:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-03" label="apps/agent/src/agent.ts"}
		// The daily budget, checked BEFORE the model is called: a turn that can't afford it never starts.
		if (tokensToday(this) >= dailyBudget(this.env)) {
			return new Response("I've used today's budget. Talk tomorrow (it resets at midnight UTC).");
		}
:::

And this version charges each turn when it ends:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-03" highlight="3" label="apps/agent/src/agent.ts"}
			abortSignal: options?.abortSignal, // the client cancelled: stop paying for tokens
			// When the turn ends (or pauses for your y/n), add what every step spent to today's total.
			onFinish: ({ totalUsage }) => spend(this, totalUsage.totalTokens ?? 0),
:::

**This charge has a hole, and the next two lessons close it.** `onFinish`
runs when a turn ends normally, or pauses for your y/n. It never runs for a
turn that's cancelled or fails. So a client that cancels every turn just
before it ends spends tokens the budget never sees. Our first fix (lesson
4) still missed a case, and lesson 5 closes it. The rule to take away now:
**never charge only at the end.**

Copy [`budget.ts`](https://github.com/ryanyogan/klippy/blob/f-03/apps/agent/src/budget.ts)
and [`test/budget.spec.ts`](https://github.com/ryanyogan/klippy/blob/f-03/apps/agent/test/budget.spec.ts),
which checks that both steps of a tool turn count, that a spent Klippy
refuses without calling the model, and that one Klippy's spending never
touches another's. Ours: 23 test files, 101 tests passed.

### 3. Limits stack

From the outside in: the web app's 30 a minute per GitHub account, then
the agent's 10 a minute per Klippy for each of chat, search and files, then
the daily budget, then 8 steps a turn and 300 tokens a reply. AI Gateway's
spend limits (lesson 2) sit behind them all, in dollars.

### 4. Watch them hold

32 searches in a row, on `pnpm dev:web` with a test cookie:

:::terminal{cmd="for i in $(seq 1 32); do curl -s -o /dev/null -w '%{http_code} ' -b <cookie> 'localhost:8802/sources/search?q=pip'; done"}
200 200 200 200 200 200 200 200 200 200 [volt]429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429[text]
:::

The 429s from the 11th on are the **agent's** search limit (10 a minute per
Klippy), passed through. A minute later, 32 posts to `/sources/file` with no
file got `400` thirty times, then `429` twice: the web app's own limit.

Then the budget, with a tiny one for the test (`wrangler dev --var
DAILY_TOKEN_BUDGET:500`; the Workers AI fallback answered, not Claude):

:::terminal{cmd="KLIPPY_URL=http://localhost:8801 pnpm chat f03-budget-920"}
you> [synapse]klippy>[text] Hello there! How can I help you today?
you> [synapse]klippy>[text] [volt]I've used today's budget. Talk tomorrow (it resets at midnight UTC).[text]
you> [synapse]klippy>[text] [volt]I've used today's budget. Talk tomorrow (it resets at midnight UTC).[text]
:::

The first turn ran (0 is under 500 when it starts) and spent more than 500
on its own: the system prompt and ten tool descriptions go with every call.
The next two were refused without a model call. Checking before and charging
after means the last turn of a day can go over by one turn. That's the price
of not knowing a turn's size up front, and it's another reason lesson 4
charges an estimate first.

:::quiz{id="rate-limit-key" xp=20}
Why is USER_LIMITER keyed on your GitHub id and not on the caller's IP address?

- [ ] IP addresses aren't available in a Worker
  Not quite. They are (cf-connecting-ip). They're just the wrong key.
- [x] Many people share one address, and one person can have many
  Right. Who you are is the fair key, and Cloudflare's docs advise the same.
- [ ] Because the rate limit is exact per user
  Not quite. It's approximate and per location. The exact limit is the daily budget.
:::

Your code matches tag `f-03`
([changes from f-02](https://github.com/ryanyogan/klippy/compare/f-02...f-03)).

:::rabbithole
- read "Rate Limiting" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/"
:::
