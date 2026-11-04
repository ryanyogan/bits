---
# sources (checked 2026-11-03):
# - Cloudflare Agents, State and storage (this.sql: the agent's own SQLite)
#   https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
# - Anthropic, Effective context engineering for AI agents (memory outside the context window, kept small)
#   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
# - Klippy c-04 → c-05, recorded output docs/outputs/c-05.txt (2026-11-03). The Workers AI fallback
#   (@cf/zai-org/glm-4.7-flash) answered, not Claude.
title: "Klippy remembers you"
order: 5
minutes: 25
xp: 70
module: An agent of your own
device: desk
tag: c-04
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
  zod: "4.6.7"
---

Klippy keeps your chat, but only the last 40 messages, and a fresh start
wipes it. This lesson gives it **long-term memory**: facts about you that
outlive the chat. Klippy decides what to remember with a tool, and keeps the
facts in its own database.

Two kinds of memory, then:

- **Short-term**: the chat history. Capped at 40 messages, sent whole every
  turn.
- **Long-term**: a short list of facts. Survives a cleared chat, and rides
  in the system prompt every turn, so it costs a few tokens each time. Keep
  it small.

### 1. A table of facts

Every agent has its own SQLite database: the one already holding its chat.
`this.sql` runs a query on it. Make `apps/agent/src/tools/memory.ts`:

:::code{file="apps/agent/src/tools/memory.ts" lang="ts" tag="c-05" highlight="5-12" label="apps/agent/src/tools/memory.ts"}
import { tool } from 'ai';
import { z } from 'zod';
import type { Klippy } from '../agent';

// Long-term memory has limits too: at most 50 facts of up to 200 characters, so the system prompt stays small.
export const MAX_FACTS = 50;
export const MAX_FACT = 200;

// The facts this Klippy knows, from its own SQLite (the same database that holds its chat).
export function facts(agent: Klippy) {
	agent.sql`CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY, fact TEXT NOT NULL)`;
	return agent.sql<{ id: number; fact: string }>`SELECT id, fact FROM facts ORDER BY id`;
}
:::

- The table is created on first use, so there's no migration to run.
- The limits are a budget: 50 facts of at most 200 characters keeps the
  system prompt small, whatever the model tries to store.
- Each Klippy has its own table. Sam's facts never reach Alex.

### 2. Two tools: remember and forget

The model writes to memory itself, with tools:

:::code{file="apps/agent/src/tools/memory.ts" lang="ts" tag="c-05" highlight="2-9" label="apps/agent/src/tools/memory.ts"}
export function memoryTools(agent: Klippy) {
	const remember = tool({
		description:
			'Remember a lasting fact about the user for future chats: their name, preferences, people and plans. Not for one-off questions or things only true today.',
		inputSchema: z.object({ fact: z.string().trim().min(1).max(MAX_FACT).describe('One short fact, e.g. "Has a dog called Pip"') }),
		execute: async ({ fact }) => {
			if (facts(agent).length >= MAX_FACTS) return { error: `Memory is full (${MAX_FACTS} facts). Forget one first.` };
			const [row] = agent.sql<{ id: number }>`INSERT INTO facts (fact) VALUES (${fact}) RETURNING id`;
			return { remembered: { id: row.id, fact } };
		},
	});

	const forget = tool({
		description: 'Forget a fact you remembered, by its id from "What you know about the user". Use it when the user asks, or a fact is wrong.',
		inputSchema: z.object({ id: z.number().int().describe('The id of the fact') }),
		execute: async ({ id }) => {
			facts(agent); // makes sure the table exists
			agent.sql`DELETE FROM facts WHERE id = ${id}`;
			return { forgot: id };
		},
	});

	return { remember, forget };
}
:::

- `remember`'s description says what's worth keeping: lasting facts, not
  one-off questions. That sentence is a prompt; it decides what Klippy
  stores.
- At 50 facts, it returns an error the model can read and act on, instead
  of throwing.
- `forget` takes an id. The model gets the ids from the system prompt, next.

### 3. Put the facts in the prompt

In `apps/agent/src/agent.ts`, import `facts` and `memoryTools`, then build
the system prompt fresh each turn:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="c-05" highlight="1-13" label="apps/agent/src/agent.ts"}
		// Read the facts fresh every turn, so the model sees what it remembered a moment ago.
		const known = facts(this).map(({ id, fact }) => `${id}: ${fact}`);
		const result = streamText({
			model: model(this.env),
			system: [
				'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
				'What you know about the user (id: fact):',
				known.join('\n') || '(nothing yet)',
			].join('\n'),
			// The conversation so far, minus any message that was too long (it stays in the chat, but never reaches the model).
			messages: await convertToModelMessages(this.messages.filter((m) => m.role !== 'user' || textOf(m).length <= MAX_QUESTION)),
			maxOutputTokens: 300,
			tools: { getWeather, getTime, ...memoryTools(this) },
			stopWhen: isStepCount(3),
			abortSignal: options?.abortSignal, // the client cancelled: stop paying for tokens
		});
:::

Reading the facts **every turn** matters: a fact remembered one message ago
is in the very next prompt.

### 4. A way to clear the chat

To see memory outlive the chat, the terminal needs a way to wipe it. In
`scripts/chat.ts`, import `MessageType` from `@cloudflare/ai-chat/types`,
change the welcome line to mention `/clear`, and handle it at the top of the
loop:

:::code{file="apps/agent/scripts/chat.ts" lang="ts" tag="c-05" highlight="3-8" label="apps/agent/scripts/chat.ts"}
	if (!text.trim()) { process.stdout.write('you> '); continue; }
	// "/clear" wipes this Klippy's chat history. What it remembered (c-05) stays.
	if (text.trim() === '/clear') {
		agent.send(JSON.stringify({ type: MessageType.CF_AGENT_CHAT_CLEAR }));
		messages = [];
		process.stdout.write('(chat cleared)\nyou> ');
		continue;
	}
:::

`CF_AGENT_CHAT_CLEAR` asks the agent to delete its stored chat. The facts
table is untouched.

### 5. Try it

Copy [`test/memory.spec.ts`](https://github.com/ryanyogan/klippy/blob/c-05/apps/agent/test/memory.spec.ts)
from the repo. It checks that a fact reaches the prompt, can be forgotten,
stays with its own Klippy, and that the 51st is refused:

:::terminal{cmd="pnpm exec vitest run test/memory.spec.ts"}
 ✓ remembers a fact and puts it in the system prompt from then on
 ✓ forgets a fact by its id
 ✓ keeps each Klippy's memory to itself
 ✓ refuses a 51st fact
[volt] Tests  4 passed (4)
:::

Then talk to it. Our run (the Workers AI fallback answered, not Claude; the
lines were piped in, so they don't echo):

:::terminal{cmd="printf &quot;Please remember that my sister is called Maya.\n/clear\nWhat is my sister called?\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat jo"}
Talking to Klippy "jo" (0 messages so far). /clear to start over, Ctrl+D to quit.
you> [synapse]klippy>[text] I've remembered that your sister is called Maya!
you> [muted](chat cleared)
you> [synapse]klippy>[text] Your sister's name is Maya.
:::

After `/clear`, the chat held only that last question and answer. The name
came from the facts. Now the other way:

:::terminal{cmd="printf &quot;Forget what you know about my sister.\n/clear\nWhat is my sister called?\n&quot; | KLIPPY_URL=http://localhost:8801 pnpm chat jo"}
Talking to Klippy "jo" (2 messages so far). /clear to start over, Ctrl+D to quit.
you> [synapse]klippy>[text] I'll forget the fact about your sister for you.
I've forgotten what I know about your sister.
you> [muted](chat cleared)
you> [synapse]klippy>[text] I don't currently have any information about your sister in my records. [muted](…)
:::

The model found the fact's id in its prompt and called `forget` with it.

**A risk to remember.** `remember` is a write the model makes on its own.
Later in this course Klippy reads web pages, and a page could try to plant a
"fact" in its memory. Lesson 7 shuts that door.

:::quiz{id="memory-where" xp=20}
You `/clear` the chat, and Klippy still knows your sister's name. Where did it come from?

- [ ] The chat history: `/clear` only hides it from you
  Not quite. The agent deletes its stored chat. After the clear, it held only the new question.
- [x] The facts table, read fresh into the system prompt on every turn
  Right. Long-term memory lives outside the chat, and reaches the model through the prompt.
- [ ] The model remembers it between calls
  Not quite. The model remembers nothing between calls. Everything it knows comes in with each request.
:::

Your code matches tag `c-05`
([changes from c-04](https://github.com/ryanyogan/klippy/compare/c-04...c-05)).

:::rabbithole
- read "Effective context engineering for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
- read "Store and sync state" by="Cloudflare" url="https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/"
:::
