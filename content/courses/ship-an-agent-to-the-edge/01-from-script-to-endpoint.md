---
# sources (checked 2026-10-27):
# - Cloudflare, Secrets (secrets vs vars; .dev.vars or .env for local dev, never both;
#   `wrangler secret put` creates and deploys a new version; `secrets.required`)
#   https://developers.cloudflare.com/workers/configuration/secrets/
# - Cloudflare, Wrangler configuration (`secrets.required` fails deploys with a missing secret;
#   name, main and compatibility_date are the minimum; set compatibility_date to today)
#   https://developers.cloudflare.com/workers/wrangler/configuration/
# - Cloudflare, Workers limits (Free: 100,000 requests a day)
#   https://developers.cloudflare.com/workers/platform/limits/
# - Cloudflare, Workers best practices (generate Env with `wrangler types`; no hardcoded secrets)
#   https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
# - Anthropic, TypeScript SDK (client.messages.create, content blocks narrowed by type,
#   output_config.effort) via the claude-api reference; model ids from Models overview
#   https://platform.claude.com/docs/en/about-claude/models/overview
# Wrangler output in the terminal block is an example, trimmed.
title: "From script to endpoint"
order: 1
minutes: 7
xp: 40
module: From script to endpoint
---

In **Your first agent loop**, the agent ran on your laptop with your API key
in a `.env` file. That's fine for you. To let anyone else use it, it needs two
things: a **URL**, and a place to run where the **key never leaves the
server**.

That place is a **Cloudflare Worker**: a small TypeScript function that
Cloudflare runs on its network, close to whoever calls it. A request comes
in, your `fetch` handler runs, a response goes out. The free plan covers
100,000 requests a day (as of October 2026).

Here's the smallest useful one: a `POST` endpoint that forwards a question to
Claude and returns the answer.

:::code{file="src/index.ts" lang="ts" highlight="12-17" label="the Claude call"}
import Anthropic from "@anthropic-ai/sdk";

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("POST a JSON body: { question }", { status: 405 });
    }
    const { question } = await request.json<{ question?: unknown }>();
    if (typeof question !== "string" || question.length > 2000) {
      return new Response("question must be a string under 2,000 characters", { status: 400 });
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" }, // chat-sized answers
      messages: [{ role: "user", content: question }],
    });

    const answer = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return Response.json({ answer, usage: res.usage });
  },
} satisfies ExportedHandler<Env>;
:::

:::code{file="wrangler.jsonc" lang="json"}
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ask-claude",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-27",
  "secrets": { "required": ["ANTHROPIC_API_KEY"] },
  "observability": { "enabled": true }
}
:::

For local runs with `npx wrangler dev`, the key goes in a `.dev.vars` file next to the config:

:::code{file=".dev.vars" lang="env"}
# Local only. Add .dev.vars to .gitignore.
ANTHROPIC_API_KEY=sk-ant-…
:::

`src/index.ts` is the Worker. `wrangler.jsonc` tells Wrangler, Cloudflare's
CLI, what to deploy; `secrets.required` makes a deploy fail loudly if the key
is missing. The `Env` type comes from running `npx wrangler types`,
so `env.ANTHROPIC_API_KEY` is typed without you writing an interface.

The handler checks its input before spending a token: a public URL gets
called by things that aren't your app.

---

For the deployed Worker, the key goes in as an encrypted **secret**, not in
the config file:

:::terminal{cmd="wrangler secret put ANTHROPIC_API_KEY"}
[muted]# example output
[quiet]✔ Enter a secret value: [muted]…
[volt]✨ Success! Uploaded the secret
:::

`wrangler secret put` creates and deploys a new version straight away. Then
`npx wrangler deploy` uploads your code and prints your `workers.dev` URL. As
of October 2026 Cloudflare also has a new `cf` CLI in beta; this course
sticks to Wrangler, which the Agents docs use.

:::quiz{id="where-the-key-lives" xp=20}
Where should the Anthropic API key live for the deployed Worker?

- [ ] In `vars` in wrangler.jsonc
  Not quite. `vars` are plain text, committed with your config and visible in the dashboard. Cloudflare's docs say never to put secrets there.
- [x] In a Worker secret, set with `wrangler secret put`
  Right. It's encrypted, reaches your code as `env.ANTHROPIC_API_KEY`, and never appears in your repo.
- [ ] In the browser, so the page can call Claude directly
  Not quite. Anything sent to a browser can be read by its user, who could then spend on your account.
:::

:::quiz{id="why-validate" xp=20}
Why does the handler check `question` before calling Claude?

- [ ] Claude can't read long questions
  Not quite. Claude Haiku 5.5 has a 1M-token context window. The limit is ours, not the model's.
- [x] Anyone can call a public URL, and every call that reaches Claude costs you tokens
  Right. Reject bad input with a cheap 400 before the expensive part runs.
- [ ] Workers reject JSON bodies over 2,000 characters
  Not quite. Workers accept much bigger bodies. 2,000 is a limit we chose.
:::

:::rabbithole
- read "Get started with Workers (CLI)" by="Cloudflare" url="https://developers.cloudflare.com/workers/get-started/guide/"
- read "Secrets" by="Cloudflare" url="https://developers.cloudflare.com/workers/configuration/secrets/"
:::
