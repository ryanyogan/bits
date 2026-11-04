---
# sources (checked 2026-10-27; Klippy steps 2026-11-03):
# - Anthropic, Define tools, "Forcing tool use" (tool_choice auto / any / tool / none; auto is the
#   default with tools; any and tool prefill the call, so no text comes before it and thinking is
#   skipped; Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 return a 400 for any and tool;
#   Haiku 5.5 accepts them) https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - AI SDK, Tool calling: toolChoice ('auto' | 'required' | 'none' | { type: 'tool', toolName })
#   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
# - Klippy b-05 → b-06, recorded output docs/outputs/b-06.txt (2026-11-03). The Workers AI fallback
#   answered both routes, not Claude.
title: "Choosing when Claude calls"
order: 6
minutes: 20
xp: 60
module: Getting calls right
device: desk
tag: b-05
verified: 2026-11-03
versions:
  ai: "7.0.162"
  wrangler: "4.157.0"
---

So far Claude decides for itself whether a question needs a tool. That's
usually right. But sometimes you know better: a route whose only job is to
save a note shouldn't be chatting. A setting called **tool choice** lets
you decide. In this lesson you'll add a second route, `POST /note`, where
Claude has no choice to make.

### The four settings

The AI SDK calls it `toolChoice`. Claude's API calls it `tool_choice`, with
slightly different names:

- `'auto'` (Claude API: `auto`): Claude decides whether to call a tool or
  just answer. The default.
- `'required'` (`any`): Claude must call a tool, and picks which.
- `{ type: 'tool', toolName }` (`tool`): Claude must call this one tool.
- `'none'` (`none`): Claude can't call a tool this turn, even though
  they're defined.

**`auto`** is right most of the time. **`none`** is handy for a plain-text
answer from a conversation that has tools in it, such as a final summary.

The two that force a call come with catches. The API starts Claude's reply
with the call for you, so Claude skips thinking first. And **forcing
depends on the model**: as of November 2026, Claude Haiku 5.5 accepts it,
but Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 reject a forced
call with a **400 error**. On those, leave it on `auto` and ask in words
("Use the saveNote tool"), then check that the call came back.

:::quiz{id="pick-a-choice" xp=20}
Your support bot has tools, but on the last turn you want a plain summary of the chat, with no more lookups. Which setting?

- [ ] auto
  Not quite. Claude might decide to look something up again.
- [x] none
  Right. The tools stay defined, but Claude can't call them this turn.
- [ ] required (any)
  Not quite. That forces a tool call, the opposite of what you want.
:::

### 1. Say auto out loud

`/ask` already uses `auto`, the default. Write it out in `apps/agent/src/ask.ts`
anyway, after `tools`, so the next person to read the code knows it's a
choice:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-06" highlight="2-2" label="apps/agent/src/ask.ts"}
		tools,
		toolChoice: 'auto', // the default, written out: Claude decides whether to call a tool, and which
:::

### 2. A route that must save

`/note` takes messy text, like "ugh remind me 2 call sam re the bike fri",
and saves it as one tidy note. Make `apps/agent/src/note.ts`:

:::code{file="apps/agent/src/note.ts" lang="ts" tag="b-06" highlight="7-19" label="apps/agent/src/note.ts"}
import { generateText, isStepCount } from 'ai';
import { model } from './model';
import { noteTools } from './tools/notes';

// POST /note: turn messy text into one tidy note. Here Claude has no choice to make: it must save.
export async function tidyNote(env: Env, text: string) {
	const { saveNote } = noteTools(env.DB);
	const { toolResults } = await generateText({
		model: model(env),
		system: "Rewrite the user's text as one short, clear note and save it. Keep every name, date and number.",
		messages: [{ role: 'user', content: text }],
		maxOutputTokens: 300,
		tools: { saveNote },
		// Force this one tool: no chatting, no other tool. ("required" would force *some* tool.)
		toolChoice: { type: 'tool', toolName: 'saveNote' },
		// The saved note is the answer, so stop after the call: no second model call to say "done".
		stopWhen: isStepCount(1),
	});
	return toolResults[0]?.output; // undefined when the call failed, e.g. a note over 1,000 characters
}
:::

- Only `saveNote` is offered, and `toolChoice: { type: 'tool', toolName:
  'saveNote' }` forces it. Claude must call it. It can't answer in text.
- `isStepCount(1)` stops after that one call. The saved note is the
  answer, so there's no second model call to say "Done!". That's half the
  cost.
- `toolResults[0]?.output` is what `saveNote` returned. It's `undefined`
  when the call failed, for example when the tidied note was over 1,000
  characters and the schema refused it.

Forcing works here because Klippy runs on Claude Haiku 5.5. If you switched
to Claude Opus 5.5, this call would fail with a 400.

### 3. The same locks on every route

`/note` spends your model budget and writes to your database, so it needs
exactly the locks `/ask` has. Rather than copy them, move them into one
function at the bottom of `apps/agent/src/index.ts`:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="b-06" highlight="3-17" label="apps/agent/src/index.ts"}
// Every route that spends your model budget goes through the same locks: your token, the rate limit,
// and a body field that must be a string of 1 to 2,000 characters. Returns the text, or the error to send.
async function guardedText(request: Request, env: Env, field: string): Promise<string | Response> {
	if (!(await isOwner(request, env))) {
		return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
	}
	if (!(await underLimit(env, clientAddress(request)))) {
		return Response.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
	}
	// Never trust the body: check that the field really is a string before using it.
	const body = await request.json<Record<string, unknown>>().catch(() => null);
	const value = body?.[field];
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text || text.length > MAX_QUESTION) {
		return Response.json({ error: `Send {"${field}": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
	}
	return text;
}
:::

It returns the text if every lock passes, or the error `Response` to send.
`field` is the name of the JSON field to read: `question` for `/ask`,
`text` for `/note`. Then both routes shrink to a few lines:

:::code{file="apps/agent/src/index.ts" lang="ts" tag="b-06" highlight="7-13" label="apps/agent/src/index.ts"}
		if (url.pathname === '/ask' && request.method === 'POST') {
			const question = await guardedText(request, env, 'question');
			if (question instanceof Response) return question;
			return Response.json(await ask(env, question));
		}

		if (url.pathname === '/note' && request.method === 'POST') {
			const text = await guardedText(request, env, 'text');
			if (text instanceof Response) return text;
			const note = await tidyNote(env, text);
			if (!note) return Response.json({ error: "Klippy couldn't save that note. Try a shorter one." }, { status: 422 });
			return Response.json(note);
		}
:::

`/note` answers `422` when nothing was saved. Import `tidyNote` from
`./note` at the top.

### 4. See what forcing means

Our run:

:::terminal{cmd="curl -s -X POST http://localhost:8801/note -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;text&quot;:&quot;ugh remind me 2 call sam re the bike fri, he said after 5&quot;}'"}
{"saved":{"id":3,"body":"Reminder to call Sam about the bike Friday, he said after 5"}}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/note -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;text&quot;:&quot;what is 2+2?&quot;}'"}
{"saved":{"id":4,"body":"What is 2+2?"}}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;What is 2+2?&quot;}'"}
{"answer":"2+2 equals 4.","model":"@cf/zai-org/glm-4.7-flash"}
:::

Look at the second one. Sent to `/note`, "what is 2+2?" was **saved as a
note**, not answered. That's forcing: the model had one move, and it made
it. The same question to `/ask`, on `auto`, got an answer and no tool. The
fallback model answered all three; forcing works the same on Claude Haiku
5.5.

And without the token, `/note` is shut, like `/ask`:

:::terminal{cmd="curl -s -X POST http://localhost:8801/note -d '{&quot;text&quot;:&quot;no token&quot;}'"}
{"error":"Send Authorization: Bearer <your KLIPPY_TOKEN>"}
:::

The repo's [`test/note.spec.ts`](https://github.com/ryanyogan/klippy/blob/b-06/apps/agent/test/note.spec.ts)
covers the forced call, the 401 and the 422. Copy it and run `pnpm test`.
Ours: 25 passed.

:::quiz{id="forced-on-opus" xp=20}
You move a working app from Claude Haiku 5.5 to Claude Opus 5.5. It forces `{ type: 'tool', toolName: 'extractInvoice' }`. What happens, and what's the fix?

- [ ] It works the same
  Not quite. Opus 5.5 doesn't accept forced tool use.
- [x] A 400 error. Use auto, tell Claude to use extractInvoice in the prompt, and check the call came back.
  Right. Forcing depends on the model. Asking in words works on every one.
- [ ] Claude ignores the setting and answers in text
  Not quite. The API refuses the request, so the setting isn't silently dropped.
:::

Commit. Your code matches tag `b-06`
([changes from b-05](https://github.com/ryanyogan/klippy/compare/b-05...b-06)).

:::rabbithole
- read "Define tools: forcing tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
- read "Tool calling: tool choice" by="AI SDK" url="https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling"
:::
