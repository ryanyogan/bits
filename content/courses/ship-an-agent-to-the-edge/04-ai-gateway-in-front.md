---
# sources (checked 2026-10-27):
# - Cloudflare, AI Gateway: Anthropic provider (base URL
#   https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic; cf-aig-authorization;
#   with stored keys set apiKey to a placeholder and null out x-api-key and Authorization)
#   https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/
# - Cloudflare, BYOK (keys kept in Secrets Store; the stored key is used only when the request
#   carries no provider auth header; rotate without a deploy)
#   https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
# - Cloudflare, Authenticated Gateway (a token with Run permission; tokens are account-scoped)
#   https://developers.cloudflare.com/ai-gateway/configuration/authentication/
# - Cloudflare, AI Gateway logging (prompt, response, tokens, cost, duration;
#   cf-aig-collect-log-payload: false keeps metadata only)
#   https://developers.cloudflare.com/ai-gateway/observability/logging/
# - Cloudflare, AI Gateway caching (off by default; cache key is a hash of provider, endpoint,
#   model, auth header and the full body: exact match only; cf-aig-cache-status HIT/MISS)
#   https://developers.cloudflare.com/ai-gateway/features/caching/
# - Cloudflare, Custom metadata (cf-aig-metadata, up to five entries; used by spend limits)
#   https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/
# - Anthropic, Prompt caching (prefix match; cache reads cost a fraction of base input)
#   https://platform.claude.com/docs/en/build-with-claude/prompt-caching
# - bits itself: apps/web/app/runs/model.ts (AI Gateway + BYOK, CF_AIG_TOKEN secret; AGENTS.md
#   "Live prompts")
title: "AI Gateway in front of the model"
order: 4
minutes: 7
xp: 40
module: Memory and the gateway
---

So far the Worker talks to Anthropic directly. Once real people use it,
you'll want answers to questions like: what did the agent send, what did it
cost, and which user is burning tokens? **Cloudflare AI Gateway** sits between
your Worker and Anthropic and records all of it.

It's one change: point the SDK at your gateway's URL instead of
`api.anthropic.com`.

:::code{file="src/gateway.ts" lang="ts" highlight="5-13" label="the gateway client"}
import Anthropic from "@anthropic-ai/sdk";

export function gatewayClient(env: Env, userId: string) {
  return new Anthropic({
    apiKey: "placeholder", // removed by the null headers below
    baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/anthropic`,
    defaultHeaders: {
      "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
      "cf-aig-metadata": JSON.stringify({ user_id: userId }),
      "x-api-key": null,
      Authorization: null,
    },
  });
}
:::

Notice what's **missing**: the Anthropic key. With **BYOK** ("bring your own
key"), you store the key in the gateway once, from the dashboard. The Worker
holds only `CF_AIG_TOKEN`, a Cloudflare token that lets it use the gateway.
The gateway adds the stored key on the way out, but only when the request
carries no provider key of its own. That's why the SDK's `x-api-key` and
`Authorization` headers are set to `null`: if a placeholder key went out, the
gateway would forward it and Anthropic would reject it.

This is how bits itself runs. Every live prompt you write in this sandbox
goes from the Worker through AI Gateway, with the key stored there.

---

What you get for that one change:

**Logs.** Each request's prompt, response, token counts, cost and duration,
searchable in the dashboard. For sensitive apps, send
`cf-aig-collect-log-payload: false` to keep the counts but not the text.

**Per-user tags.** `cf-aig-metadata` attaches up to five fields to each
request. Tag the user id and you can filter logs by user, and (next lesson)
give each user a spend limit.

**Key rotation without a deploy.** Replace the stored key in the dashboard and
the next request uses it.

**Caching**, with a big caveat for agents:

:::quiz{id="gateway-cache" xp=20}
You turn on AI Gateway's response cache for your chat agent. How often will it hit?

- [ ] Often: similar questions share an answer
  Not quite. The gateway's cache key is a hash of the whole request body. “Weather in Paris?” and “weather in paris” are two different keys.
- [x] Rarely: every turn resends a different, growing history
  Right. It only serves exact repeats, and a conversation is never the same request twice. It helps fixed prompts, not chats.
- [ ] Always after the first message, since the system prompt is the same
  Not quite. That's Anthropic's prompt caching, which matches a shared prefix. The gateway's cache needs the entire request to match.
:::

Keep the two caches straight. **AI Gateway caching** replays a whole stored
response for an identical request; it's off by default. **Anthropic's prompt
caching** reuses the processed prefix of your prompt (tools, system prompt,
earlier turns), and cached input tokens cost a fraction of the normal price.
For an agent, prompt caching is the one that pays.

:::quiz{id="byok-holds" xp=20}
With BYOK set up, what does your Worker need as a secret?

- [ ] The Anthropic API key, sent on every request
  Not quite. If the request carries a provider key, the gateway forwards it and skips the stored one.
- [x] Only the gateway token, `CF_AIG_TOKEN`
  Right. The Anthropic key lives in the gateway. A leaked Worker secret can't be used directly against Anthropic.
- [ ] Nothing: the gateway is public
  Not quite. Turn on Authenticated Gateway, or anyone who learns your URL can spend through it. Note the token can use every gateway on the account.
:::

:::rabbithole
- read "AI Gateway: Anthropic" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/"
- read "BYOK (store keys)" by="Cloudflare" url="https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/"
- read "Prompt caching" by="Anthropic" url="https://platform.claude.com/docs/en/build-with-claude/prompt-caching"
:::
