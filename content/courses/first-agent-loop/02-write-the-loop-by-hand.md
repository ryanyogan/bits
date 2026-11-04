---
# sources (checked 2026-11-03):
# - Anthropic, Messages API: tool use (tool_use and tool_result blocks, stop_reason, the assistant turn sent back whole)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Anthropic, Building effective agents (the loop, stopping conditions)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Klippy c-01 → c-02, recorded output docs/outputs/c-02.txt (2026-11-03, @anthropic-ai/sdk 1.4.0, tsx 4.23.15).
#   The live run with Claude is NOT recorded (no key was available to the recording); the fake-client test and a
#   deliberately wrong key's 401 are. The lesson says so.
title: "Write the loop by hand, once"
order: 2
minutes: 25
xp: 70
module: What an agent is
device: desk
tag: c-01
verified: 2026-11-03
versions:
  "@anthropic-ai/sdk": "1.4.0"
  tsx: "4.23.15"
  wrangler: "4.157.0"
---

In course B, one line did the looping for you: `stopWhen: isStepCount(3)`.
This lesson takes that line apart. You'll write the loop by hand, about 30
lines, talking straight to Claude's Messages API, watch it run in a test,
then delete it. After this, `stopWhen` will never be magic again.

### 1. Two tools for a script

The loop runs as a script on your machine, in Node, not in the Worker. So
it needs two **dev** dependencies: Anthropic's SDK, and `tsx`, which runs a
TypeScript file directly. From `klippy/`:

```sh
pnpm --filter agent add -D --save-exact @anthropic-ai/sdk@1.4.0 tsx@4.23.15
```

Then three small edits in `apps/agent`:

- `package.json`: add `"type": "module",` under `"private": true`. Without
  it, `tsx` refuses the `await` at the top of the script (we hit exactly
  that error first).
- `package.json`: add a script, `"loop": "tsx --env-file=.dev.vars scripts/loop.ts"`.
  `--env-file` loads your `.dev.vars`, so the script can read your key.
- `tsconfig.json`: add `"scripts/**/*.ts"` to `include`, so `pnpm typecheck`
  checks the script too.

This one script talks to Claude directly, with your own Anthropic key, not
through the gateway. Add it to `apps/agent/.dev.vars` (never commit that
file):

```sh
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .dev.vars
```

### 2. One tool, the way the API wants it

Make `apps/agent/scripts/loop.ts`. First the tool. In course B, `tool()`
and zod built this for you. Here you write what actually goes over the
wire: a name, a description, and a JSON schema for the input.

:::code{file="apps/agent/scripts/loop.ts" lang="ts" tag="c-02" highlight="4-6" label="apps/agent/scripts/loop.ts"}
import Anthropic from '@anthropic-ai/sdk';

// One tool, written the way the Messages API wants it: a name, a description, and a JSON schema for its input.
const tools: Anthropic.Tool[] = [
	{ name: 'get_time', description: 'Get the current date and time (UTC).', input_schema: { type: 'object', properties: {} } },
];
:::

`get_time` takes no input (`properties: {}`), so Claude only has to decide
**whether** to call it.

### 3. The loop

Now the loop itself. Read it slowly: this is what every agent framework
runs underneath.

:::code{file="apps/agent/scripts/loop.ts" lang="ts" tag="c-02" type-mode highlight="2-10" label="apps/agent/scripts/loop.ts"}
// The loop that generateText ran for you in course B: ask Claude, run the tools it asks for, send back the results.
export async function loop(client: Anthropic, question: string, maxTurns = 5) {
	const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];
	for (let turn = 1; turn <= maxTurns; turn++) {
		const response = await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1024, tools, messages });
		console.log(`turn ${turn}: stop_reason = ${response.stop_reason}`);
		// "tool_use": Claude wants a tool run. Anything else ("end_turn", "max_tokens", ...) ends the loop.
		if (response.stop_reason !== 'tool_use') {
			return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
		}
:::

- `messages` is the whole conversation. Each turn sends **all** of it:
  Claude remembers nothing between calls.
- `maxTurns` is your `stopWhen`. Without it, a model that keeps asking for
  tools would loop, and bill you, forever.
- `stop_reason` says why Claude stopped. `"tool_use"` means "run a tool for
  me and tell me what happened". Anything else (`"end_turn"`,
  `"max_tokens"`, `"refusal"`) means this turn is over: return the text.

### 4. Act, then observe

When Claude asks for a tool, two messages go back on the pile:

:::code{file="apps/agent/scripts/loop.ts" lang="ts" tag="c-02" highlight="1-5" label="apps/agent/scripts/loop.ts"}
		messages.push({ role: 'assistant', content: response.content }); // Claude's turn, tool calls and all
		const results = response.content.flatMap((block) =>
			block.type === 'tool_use' ? [{ type: 'tool_result' as const, tool_use_id: block.id, content: new Date().toISOString() }] : [],
		);
		messages.push({ role: 'user', content: results }); // every result, in one message, matched by id
	}
	return 'Stopped: too many turns.'; // your stopWhen
}
:::

- **Claude's turn, whole.** Its `content` holds the tool calls, each with
  an `id`. Send them back as they came, not just the text.
- **Every result, in one user message**, each matched to its call by
  `tool_use_id`. That's the observe step: ground truth from your code,
  which Claude reads on the next turn.
- If the loop runs out of turns, it says so, instead of pretending.

The AI SDK's names map straight onto these: `stop_reason: "tool_use"` is
its `finishReason: "tool-calls"`, and `maxTurns` is `stopWhen`.

### 5. Run it

The end of the file runs the loop when you call the script:

:::code{file="apps/agent/scripts/loop.ts" lang="ts" tag="c-02" label="apps/agent/scripts/loop.ts"}
// `pnpm loop "What time is it?"` runs this file, with ANTHROPIC_API_KEY from .dev.vars (Node, not the Worker).
if (import.meta.main) {
	console.log(await loop(new Anthropic(), process.argv.slice(2).join(' ') || 'What time is it?'));
}
:::

In `apps/agent`:

```sh
pnpm loop "What time is it right now?"
```

You should see `turn 1: stop_reason = tool_use`, then
`turn 2: stop_reason = end_turn`, then Claude's answer with the time.

**What we recorded, and what we didn't.** We haven't recorded this run
with Claude yet: the recording had no Anthropic key. With a deliberately
wrong key, the call does reach the API, which proves the wiring:

:::terminal{cmd="pnpm loop &quot;What time is it?&quot;"}
AuthenticationError: 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}
[muted](a 401 means the loop, the SDK and the request work; only the key was wrong)
:::

If you see `Top-level await is currently not supported with the "cjs"
output format`, you skipped `"type": "module"` in step 1.

### 6. Prove it without a key

A test can stand in for Claude with a fake client that answers
`tool_use` first and `end_turn` second. Copy
[`test/loop.spec.ts`](https://github.com/ryanyogan/klippy/blob/c-02/apps/agent/test/loop.spec.ts)
from the repo, then run it:

:::terminal{cmd="pnpm exec vitest run test/loop.spec.ts"}
turn 1: stop_reason = tool_use
turn 2: stop_reason = end_turn
turn 1: stop_reason = tool_use
turn 2: stop_reason = tool_use
turn 3: stop_reason = tool_use
 ✓ runs the tool Claude asks for, sends the result back, and stops at end_turn
 ✓ stops after maxTurns, however many tools Claude asks for
[volt] Tests  2 passed (2)
:::

The second test is the important one: a model that never stops asking
gets cut off at `maxTurns`.

:::quiz{id="tool-result-where" xp=20}
Claude's reply has `stop_reason: "tool_use"` with two tool calls. What do you send next?

- [ ] Just the two results, as text, in a new user message
  Not quite. Claude needs its own turn back too, and each result has to name the call it answers.
- [x] Claude's turn as it came, then one user message with both tool_result blocks, each with its tool_use_id
  Right. The whole assistant turn goes back, then every result in one message, matched by id.
- [ ] One request per tool result
  Not quite. Each request is a whole new turn. All results for one turn go back together.
:::

### 7. Now delete it

You've seen the loop. From here on, the AI SDK and Cloudflare's agent run
it for you, with streaming, approvals and saved history on top. Next
lesson starts by deleting `scripts/loop.ts`, its test, the `loop` script
and the two dev dependencies.

Your code matches tag `c-02`
([changes from c-01](https://github.com/ryanyogan/klippy/compare/c-01...c-02)).

:::rabbithole
- read "Tool use with Claude" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview"
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
:::
