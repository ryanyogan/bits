---
# sources (checked 2026-10-27):
# - Cloudflare, Rate Limiting binding (`ratelimits` with name, namespace_id, simple.limit,
#   simple.period of 10 or 60; env.X.limit({ key }) → { success }; approximate and per
#   Cloudflare location; for a strict limit use a Durable Object; key on user ids, not IPs)
#   https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
# - Cloudflare, AI Gateway spend limits (dollar budgets per model, provider or metadata such
#   as user_id; 429 when exceeded; eventually consistent; up to 20 rules)
#   https://developers.cloudflare.com/ai-gateway/features/spend-limits/
# - Anthropic, Messages API (max_tokens caps each response; usage.input_tokens /
#   output_tokens) and Pricing (Claude Sonnet 5.5: $2 / MTok input, $10 / MTok output)
#   https://platform.claude.com/docs/en/about-claude/pricing
# - Anthropic, Building effective agents (agents can loop and compound costs; add stopping
#   conditions such as a maximum number of iterations)
#   https://www.anthropic.com/engineering/building-effective-agents
title: "Limits that hold"
order: 5
minutes: 8
xp: 40
module: Running it safely
---

An agent is a loop that spends money each time round. On your laptop, the
worst case was your own bill. On the internet, the worst case is a stranger
with a script, or one confused conversation that calls a tool forever.

No single limit covers that. You stack four, from cheapest to check to most
important:

**Per request:** a rate limit stops bursts before any work happens.

**Per run:** a turn cap and `max_tokens` bound one question.

**Per user, per day:** a token budget bounds one person.

**Per account:** an AI Gateway spend limit is the backstop if your code has a bug.

---

The first one is a Workers binding. You declare it in config and call it
with a key, ideally the **user id**, not the IP address (many people can
share an IP):

:::code{file="wrangler.jsonc" lang="json"}
{
  "ratelimits": [
    {
      "name": "ASK_LIMIT",
      "namespace_id": "1001",
      "simple": { "limit": 10, "period": 60 }
    }
  ]
}
:::

:::code{file="src/index.ts" lang="ts"}
const { success } = await env.ASK_LIMIT.limit({ key: userId });
if (!success) return new Response("Slow down a little", { status: 429 });
:::

`period` must be 10 or 60 seconds. And this limiter is **approximate**:
counts are kept per Cloudflare location and synced in the background, so a
burst can slip past it. Good for bursts. Not a way to cap spending.

:::quiz{id="limiter-is-approximate" xp=20}
Why isn't the rate-limit binding enough to cap what a user can spend?

- [ ] It only counts requests, and a single request can run many expensive turns
  Partly. That's true, but there's a second reason too.
- [ ] Its counts are approximate and separate in each Cloudflare location
  Partly. That's true, but there's a second reason too.
- [x] Both: it counts requests, not tokens, and its counts are approximate per location
  Right. Use it for bursts, and count tokens somewhere exact.
:::

---

For the exact count, you already have the right place: the user's own agent.
It's one instance per user with its own database, so every turn that user
takes is counted in one spot. Here's the loop from **Your first agent loop**
with a turn cap and a daily budget added:

:::code{file="src/agent.ts" lang="ts" highlight="5-16" label="check before, count after"}
const MAX_TURNS = 6;
const DAILY_TOKENS = 200_000; // ≈ $2 a day at most on Sonnet 5.5, even if all output
const today = () => new Date().toISOString().slice(0, 10); // UTC date

for (let turn = 1; turn <= MAX_TURNS; turn++) {
  if (this.tokensToday() >= DAILY_TOKENS) {
    return "You've reached today's limit. It resets at midnight UTC.";
  }
  const res = await client.messages.create({ model, max_tokens: 4096, tools, messages });
  this.addTokens(res.usage.input_tokens + res.usage.output_tokens);
  this.save({ role: "assistant", content: res.content });

  if (res.stop_reason !== "tool_use") return textOf(res);
  this.save({ role: "user", content: await runTools(res) });
}
return "I stopped after 6 steps without an answer. Try a narrower question.";

// in the class:
tokensToday(): number {
  const [row] = this.sql<{ tokens: number }>`SELECT tokens FROM usage WHERE day = ${today()}`;
  return row?.tokens ?? 0;
}
addTokens(n: number) {
  this.sql`INSERT INTO usage (day, tokens) VALUES (${today()}, ${n})
    ON CONFLICT(day) DO UPDATE SET tokens = tokens + ${n}`;
}
:::

Check **before** each call, count **after**: you only learn the cost when the
response arrives. A request already in flight can overshoot by one turn,
which is why `max_tokens` caps each turn too. When the loop gives up, it says
so plainly instead of failing silently.

Finally, set a **spend limit** in AI Gateway: a dollar budget per day,
split by the `user_id` you tagged in the last lesson. It's eventually
consistent too, and it only sees calls that go through the gateway, but it
catches what your code misses.

:::quiz{id="max-turns-hit" xp=20}
The loop hits `MAX_TURNS` with the model still asking for tools. What's the best thing to do?

- [ ] Raise `MAX_TURNS` until it finishes
  Not quite. A loop that won't settle in six steps is usually stuck, and more turns just cost more.
- [x] Stop and tell the user, in plain words, that it ran out of steps
  Right. A clear message beats a timeout, and your logs will show which questions hit the cap.
- [ ] Return an empty 200 response
  Not quite. The user can't tell a silent failure from a slow answer.
:::

:::rabbithole
- read "Rate Limiting binding" by="Cloudflare" url="https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/"
- read "Spend limits" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/features/spend-limits/"
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
:::
