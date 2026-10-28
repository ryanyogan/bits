---
# sources (checked 2026-10-27):
# - Cloudflare, Agent class (each instance is a separate micro-server addressed by a unique
#   name; same name → same instance; embedded SQLite via this.sql; onStart / onRequest)
#   https://developers.cloudflare.com/agents/agent-class/
# - Cloudflare, Store and sync state (state is broadcast to clients on every change: keep it
#   small, put message history in SQL)
#   https://developers.cloudflare.com/agents/agent-class/state/
# - Cloudflare, Routing (getAgentByName(namespace, name) returns a stub for RPC; choose the
#   instance server-side from the session; routeAgentRequest maps /agents/:agent/:name)
#   https://developers.cloudflare.com/agents/agent-class/routing/
# - Cloudflare, Agents configuration (nodejs_compat required; durable_objects.bindings plus
#   an `exports` entry with type "durable-object" and storage "sqlite"; legacy `migrations`
#   still work)
#   https://developers.cloudflare.com/agents/runtime/operations/configuration/
# - Cloudflare, Workers best practices (module-level mutable request state leaks across requests)
#   https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
# - Anthropic, Messages API (stateless: send the full history each call; append the assistant's
#   content unchanged) via the claude-api reference
title: "One agent per user"
order: 3
minutes: 8
xp: 40
module: Memory and the gateway
---

Claude's API is **stateless**. It remembers nothing between calls; your code
sends the whole conversation every time. On your laptop, the history was an
array in memory. On Workers, that breaks.

A Worker can run in many places at once, and one copy serves many people. An
array at the top of the file would be **shared between users**, and it would
vanish whenever Cloudflare recycles the copy. Cloudflare's own best-practice
list flags module-level request state as a bug for exactly this reason.

Memory needs a home that is **one per user**, stays put, and keeps its data.
That's a **Durable Object**: an instance with a name, its own SQLite
database, and the guarantee that a given name always reaches the same
instance. Cloudflare's **Agents SDK** wraps one in an `Agent` class with
`this.sql` built in.

:::code{file="src/agent.ts" lang="ts" highlight="15-32" label="remember, then answer"}
import { Agent } from "agents";
import Anthropic from "@anthropic-ai/sdk";

type Row = { role: "user" | "assistant"; content: string };

export class ChatAgent extends Agent<Env> {
  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL
    )`;
  }

  async ask(question: string): Promise<{ answer: string }> {
    this.save({ role: "user", content: question });

    const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      messages: this.history(),
    });

    // Store the whole content, unchanged. Never edit old turns.
    this.save({ role: "assistant", content: res.content });

    const answer = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return { answer };
  }

  reset() {
    this.sql`DELETE FROM messages`; // a fresh conversation
  }

  private history(): Anthropic.MessageParam[] {
    return this.sql<Row>`SELECT role, content FROM messages ORDER BY id`
      .map((row) => ({ role: row.role, content: JSON.parse(row.content) }));
  }

  private save(message: Anthropic.MessageParam) {
    this.sql`INSERT INTO messages (role, content)
      VALUES (${message.role}, ${JSON.stringify(message.content)})`;
  }
}
:::

That's the agent. The Worker in front of it decides **which** agent a request reaches, and the config declares the class:

:::code{file="src/index.ts" lang="ts" highlight="10-12" label="pick the user's agent"}
import { getAgentByName } from "agents";
import { currentUser } from "./auth"; // your sign-in
export { ChatAgent } from "./agent";

export default {
  async fetch(request, env): Promise<Response> {
    const userId = await currentUser(request, env);
    if (!userId) return new Response("Sign in first", { status: 401 });

    const agent = await getAgentByName(env.ChatAgent, userId);
    const { question } = await request.json<{ question: string }>();
    return Response.json(await agent.ask(question));
  },
} satisfies ExportedHandler<Env>;
:::

:::code{file="wrangler.jsonc" lang="json"}
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chat-agent",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-27",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "ChatAgent", "class_name": "ChatAgent" }]
  },
  "exports": {
    "ChatAgent": { "type": "durable-object", "storage": "sqlite" }
  },
  "secrets": { "required": ["ANTHROPIC_API_KEY"] },
  "observability": { "enabled": true }
}
:::

Read it from the bottom up. The config declares a Durable Object class with
SQLite storage; the Agents SDK needs `nodejs_compat`. The Worker works out
**who** is asking, then `getAgentByName(env.ChatAgent, userId)` returns that
user's agent and calls its `ask()` method directly. Each instance keeps its
own `messages` table, so user A's history can't reach user B's prompt.

Two habits in `ask()` matter later. It stores the assistant's **whole**
content, not just the text: on current Claude models that can include
thinking blocks, which must go back unchanged. And it only ever **appends**.
To start over, clear the table and begin a new conversation instead of
trimming old turns.

:::quiz{id="instance-name" xp=20}
Where should the agent's instance name (here, `userId`) come from?

- [ ] A `?user=` query parameter the browser sends
  Not quite. Anyone can type someone else's id into a URL and read their history.
- [x] Your server's verified sign-in session
  Right. The name decides whose memory you load, so it has to come from something the caller can't forge.
- [ ] Whatever name the model suggests
  Not quite. The model's output is text, not proof of who is asking.
:::

The SDK also has `routeAgentRequest()`, which maps URLs like
`/agents/chat-agent/:name` straight to instances. It's handy, but then the
**URL** picks the instance, so you must check the caller in its
`onBeforeRequest` hook. Choosing the name yourself, as above, keeps that
decision in one place.

:::quiz{id="state-or-sql" xp=20}
The Agent class also has `setState()`, which syncs a small object to every connected client. Why keep the chat history in `this.sql` instead?

- [ ] `setState()` loses data when the agent restarts
  Not quite. State persists too. The issue is size and traffic.
- [x] State is broadcast to clients on every change, so it should stay small
  Right. Cloudflare's docs say to keep state light and put growing data like messages in SQL.
- [ ] SQL is the only storage that Claude can read
  Not quite. Claude reads whatever you send in the request. Both are just storage.
:::

:::rabbithole
- read "Agent class" by="Cloudflare" url="https://developers.cloudflare.com/agents/agent-class/"
- read "Store and sync state" by="Cloudflare" url="https://developers.cloudflare.com/agents/agent-class/state/"
- read "What are Durable Objects?" by="Cloudflare" deep url="https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/"
:::
