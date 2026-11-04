---
# sources (checked 2026-11-03):
# - Cloudflare Workers Logs (JSON logs: fields are extracted and indexed, so console.log({ user_id: 123 })
#   is filterable on user_id; 7 days retention; 256 KB per log)
#   https://developers.cloudflare.com/workers/observability/logs/workers-logs/
# - Cloudflare Workers, Query Builder (Count, Sum, P90; Filter, Group By, Order By; Save Query)
#   https://developers.cloudflare.com/workers/observability/query-builder/
# - AI SDK 7.0.162 streamText callbacks (onStepStart, onStepEnd, onFinish, onAbort), from the installed
#   package
# - Klippy f-03 → f-04, recorded output docs/outputs/f-04.txt (2026-11-03): two chat turns on wrangler dev
#   and SQL over wrangler dev's local observability API. The replies are the Workers AI fallback
#   (glm-4.7-flash), not Claude. The saved queries are NOT made: the agent isn't deployed. The budget fix
#   came from the lead's security review of f-03, and f-05 fixes it again.
# - The coached prompt is the log-line exercise from the earlier version of this lesson, unchanged.
title: "Logs you can query"
order: 4
minutes: 25
xp: 80
module: Watch and defend
device: desk
tag: f-03
verified: 2026-11-03
versions:
  agents: "0.33.0"
  ai: "7.0.162"
  wrangler: "4.157.0"
---

Two jobs in this lesson. First, close the budget hole from lesson 3. Then
give every chat turn one log line you can filter, sum and group, with
nothing a user wrote in it.

### 1. Charge before the call

Lesson 3 charged a turn in `onFinish`, which never runs for a turn that's
cancelled or fails. The simple fix is to charge each step when it ends.
That still loses the step that's cancelled, and a one-step turn is all one
step. So a client that cancels every reply just before it ends would still
spend tokens the budget never sees.

The fix is **reserve and settle**: charge an estimate before each model
call, then correct it to the real count when the call reports. First a
rough count in `budget.ts`:

:::code{file="apps/agent/src/budget.ts" lang="ts" tag="f-04" label="apps/agent/src/budget.ts"}
// A rough count for text the model hasn't seen yet: about 4 characters a token in English.
export function estimateTokens(text: string) {
	return Math.ceil(text.length / 4);
}
:::

In `agent.ts`, import it with the log helpers from step 2, and give the
reply cap a name, since the estimate needs it too:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-04" label="apps/agent/src/agent.ts"}
import { dailyBudget, estimateTokens, spend, tokensToday } from './budget';
...
import { logRefused, logTurn } from './log';
...
// The cap on each step's reply (see /ask): a hard limit on what one model call can write.
const MAX_OUTPUT = 300;
:::

The estimate needs the system prompt and the messages before
`streamText` is called, so move them out of it, into `const system = [...]`
and `const messages = await convertToModelMessages(...)`. Then pass
`system`, `messages` and `maxOutputTokens: MAX_OUTPUT` back in. Now the
estimate, from what the call sends plus the reply cap:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-04" highlight="2" label="apps/agent/src/agent.ts"}
		// What one step may cost before the model reports it: the prompt (about 4 characters a token) plus the reply cap.
		const reserve = estimateTokens(system + JSON.stringify(messages) + JSON.stringify(Object.entries(tools).map(([name, t]) => [name, t.description]))) + MAX_OUTPUT;
:::

Then charge it as each step starts, and correct it as each step ends:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-04" highlight="5-6" label="apps/agent/src/agent.ts"}
			// Charge every step, fail-closed (fixed in f-04: f-03 charged the whole turn in onFinish, which never runs for a turn
			// that's cancelled or fails, so cancelling each turn just before its end kept the budget empty). A step is charged its
			// estimate BEFORE the model is called, then corrected to the real count when it ends. A step that's cancelled or
			// fails keeps its estimate: there's no way to spend tokens the budget hasn't seen.
			onStepStart: () => spend(this, reserve),
			onStepEnd: (step) => spend(this, (step.usage.totalTokens ?? 0) - reserve),
			// Log the turn's shape as one JSON line when it ends, pauses for your y/n, or is cancelled (f-04).
			onFinish: ({ steps }) => logTurn(this.name, started, steps),
			onAbort: ({ steps }) => logTurn(this.name, started, steps, 'aborted'),
:::

A step that's cancelled or fails keeps its estimate. There's no way to
spend tokens the budget hasn't seen. `onFinish` no longer charges anything,
so nothing is counted twice. The new tests in
[`test/budget.spec.ts`](https://github.com/ryanyogan/klippy/blob/f-04/apps/agent/test/budget.spec.ts)
cancel a turn on its second step, and on its first. Both fail on lesson 3's
code and pass now. (This version still has a gap. You'll meet it in lesson
5.)

### 2. One line per turn, shape only

Workers Logs reads a logged object's fields and indexes each one, so you
can filter and group on them in the dashboard. So log an object, not a
sentence:

:::code{file="apps/agent/src/log.ts" lang="ts" tag="f-04" highlight="1-3" label="apps/agent/src/log.ts"}
// One JSON line per chat turn (f-04). Workers Logs indexes every field of a logged object, so you can filter, group and
// sum them in the dashboard's Query Builder. Log the SHAPE of a turn, never its content: no message text, no tool inputs
// or outputs (they hold notes and pages), no URLs, no tokens. The agent's name is the only id.
export function logTurn(agent: string, started: number, steps: StepResult<ToolSet>[], ended?: 'aborted') {
...
	console.log({
		event: 'turn',
		agent,
		steps: steps.length,
		finish: ended ?? last?.finishReason, // "aborted": you cancelled it. "stop": answered. "tool-calls": stopped by the step cap, or paused for your y/n
		tools: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)), // names only
		toolErrors: steps.reduce((n, step) => n + step.content.filter((part) => part.type === 'tool-error').length, 0),
		tokens: { ...usage, total: usage.input + usage.output },
		model: last?.providerMetadata?.cloudflare?.model, // Claude, or the fallback
		ms: Date.now() - started,
	});
}

// A turn Klippy refused before calling the model: why, and whose. Still no content.
export function logRefused(agent: string, reason: 'too-long' | 'rate-limit' | 'budget') {
	console.log({ event: 'turn.refused', agent, reason });
}
:::

Log the **shape** of a turn, never its content: how many steps, how it
ended, which tools by name, how many failed, tokens, which model, how long.
No message text, no tool inputs or outputs (they hold notes and pages), no
URLs, no tokens. The Klippy's name is the only id. `logTurn` runs from
`onFinish` and `onAbort` (in step 1's code), and `logRefused` runs before
each refusal: too long, rate limit, budget. `started` is set at the top of
the turn:

:::code{file="apps/agent/src/agent.ts" lang="ts" tag="f-04" label="apps/agent/src/agent.ts"}
		const started = Date.now();
...
		if (question.length > MAX_QUESTION) {
			logRefused(this.name, 'too-long');
...
		if (!(await underLimit(this.env, `chat:${this.name}`))) {
			logRefused(this.name, 'rate-limit');
...
		if (tokensToday(this) >= dailyBudget(this.env)) {
			logRefused(this.name, 'budget');
:::

The same rule reaches back to course B: **b-03's step log now records shape
only.** It logged tool inputs, results and the answer, which is fine on
your laptop and wrong in production. Since f-04 it logs the step, how it
ended, tool names, an error count and tokens:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="f-04" highlight="5-10" label="apps/agent/src/ask.ts"}
		// Log one line per step, so you can watch the round trip. Since f-04 it's the shape only: b-03's line also had the
		// tool inputs, results and text, which is fine on your laptop and wrong in production logs (notes, pages, questions).
		onStepEnd: (step) => {
			console.log({
				event: 'ask.step',
				step: step.stepNumber,
				finish: step.finishReason, // "tool-calls": Claude wants a tool. "stop": it answered.
				tools: step.toolCalls.map((call) => call.toolName), // names only
				// A failed tool call (bad input, or a service that's down) goes back to Claude as an error. Count, not text.
				toolErrors: step.content.filter((part) => part.type === 'tool-error').length,
				tokens: step.usage.totalTokens,
			});
		},
:::

Copy [`log.ts`](https://github.com/ryanyogan/klippy/blob/f-04/apps/agent/src/log.ts),
[`test/log.spec.ts`](https://github.com/ryanyogan/klippy/blob/f-04/apps/agent/test/log.spec.ts)
(which also checks that the question, the tool input and the answer never
appear) and the updated
[`test/weather.spec.ts`](https://github.com/ryanyogan/klippy/blob/f-04/apps/agent/test/weather.spec.ts).
Ours: 24 test files, 106 tests passed.

### 3. Ask the logs

`wrangler dev` keeps the logs it captured and answers SQL over them, a
local stand-in for the dashboard. Two turns (the Workers AI fallback
answered, not Claude). The first message told Klippy a secret word,
"swordfish", and the second asked the time. The SQL has quotes inside
quotes, so send it from a here-doc. Tokens per Klippy:

```sh
curl -s -X POST localhost:8801/cdn-cgi/local/explorer/api/local/observability/query -d @- <<'EOF'
{"sql": "SELECT json_extract(message, '$[0].agent') AS agent, count(*) AS turns, sum(json_extract(message, '$[0].tokens.total')) AS tokens, max(json_extract(message, '$[0].ms')) AS slowest_ms FROM logs WHERE json_extract(message, '$[0].event') = 'turn' GROUP BY agent ORDER BY tokens DESC"}
EOF
```

Each row's `message` holds the logged object inside a JSON array, hence
`$[0]`. (We wrote this here-doc form for the lesson; our recording sent the
same SQL inline.) The labels on the blocks below shorten the SQL:

:::terminal{cmd="… tokens per agent …"}
['agent', 'turns', 'tokens', 'slowest_ms']
['f04-logs-28742', 2, 7117, 7206]
:::

One of the two lines, whole (taken out of its `['[…]']` row wrapper):

:::terminal{cmd="… SELECT message FROM logs WHERE json_extract(message, '$[0].event') = 'turn' …"}
{"event":"turn","agent":"f04-logs-28742","steps":2,"finish":"stop",[volt]"tools":["remember"][text],"toolErrors":0,"tokens":{"input":3442,"output":35,"cached":0,"total":3477},"model":"@cf/zai-org/glm-4.7-flash","ms":7206}
:::

The tool's name is there, and not what it remembered. Then the test that
matters:

:::terminal{cmd="… SELECT count(*) AS lines_with_the_secret FROM logs WHERE message LIKE '%swordfish%'"}
['lines_with_the_secret']
[[volt]0[text]]
:::

We found one leak while recording, and it's not in our code. The platform's
own log of `pnpm chat`'s WebSocket request records the full URL, `?token=`
and all, before our code ever runs. That's the course C rule ("a URL ends up
in logs") seen for real. Since f-01 the deployed agent never gets a token
in a URL (the web app sends a header over the binding), so it only happens
with `pnpm chat` locally.

### 4. Save the query

After you deploy (the checkpoint), make it once in the dashboard:
**Workers & Pages → klippy → Observability.** Filter `event` equals
`turn`. Show Count, Sum of `tokens.total` and P90 of `ms`. Group by
`agent`, order by the sum, and **Save Query** as "Klippy: tokens per user".
A second one is worth saving: `event` equals `turn.refused`, Count, grouped
by `reason`. We haven't made them: our agent isn't deployed.

:::quiz{id="shape-only" xp=20}
Which of these belongs in Klippy's turn log line?

- [ ] The user's question, so you can debug bad answers
  Not quite. That's content: it stays out of logs.
- [ ] The URL readLink fetched
  Not quite. URLs carry tokens and private paths.
- [x] The names of the tools the turn called
  Right. The shape: names, counts, tokens, time. Never what went in or came out.
:::

Now try it with Claude. Some old log line has the user's words in it:

:::prompt{id="log-line" xp=20 coach}
Get Claude to turn a log sentence into a JSON object you can filter
- goal "Get Claude to rewrite the log sentence as one JSON object with numbers as numbers, keeping the run's shape and leaving out what the user wrote"
- placeholder "Turn this log line into one JSON object for Workers Logs with the fields event, user, turn, stop_reason, input_tokens, output_tokens and ms. Numbers as numbers. Leave out … JSON only. Line: …"
- draft "Make this log better: turn 2 for user 8f3a done (end_turn), 1834 in / 212 out, 2310 ms, prompt: \"is it raining at 14 Elm Street right now?\""
- check "Pastes the log line" /8f3a/
- check "Pastes the log line" /1834/
- check "Pastes the log line" /end_turn/
- check "Asks for JSON" /json|object/i
- check "Says to leave out the user's words" /no prompt|leave out|drop|omit|without|don.t include|do not include|exclude|remove/i
- expect "Has the fields" json keys=stop_reason,input_tokens,output_tokens types=input_tokens:number,output_tokens:number
- expect "Keeps the user id" match /8f3a/
- expect "Keeps the input tokens" match /input_tokens..\s?1834/
- expect "Keeps the output tokens" match /output_tokens..\s?212/
- expect "Keeps the duration" match /2310/
- rubric "Leaves out the user's prompt text and the street address" must
- hint "Which part of this line is the user's own words? Does your prompt tell Claude what to do with it?"
- hint "Name the fields you want, and say the numbers must be numbers, not strings."
- hint "Ask for one JSON object with event, user, turn, stop_reason, input_tokens, output_tokens and ms, numbers as numbers, and say to drop the prompt. JSON only."
- reference "Turn this log line into one JSON object for Workers Logs with the fields event (\"turn\"), user, turn, stop_reason, input_tokens, output_tokens and ms. Numbers must be numbers. Leave out the user's prompt entirely. Reply with the JSON object only.\n\nturn 2 for user 8f3a done (end_turn), 1834 in / 212 out, 2310 ms, prompt: \"is it raining at 14 Elm Street right now?\""
- run temperature=[1.0]
- example T=1.0 "{\"event\":\"turn\",\"user\":\"8f3a\",\"turn\":2,\"stop_reason\":\"end_turn\",\"input_tokens\":1834,\"output_tokens\":212,\"ms\":2310}"
- success "Fields you can filter, and nothing a user wrote." next="Next: safety at the edge →"
:::

Your code matches tag `f-04`
([changes from f-03](https://github.com/ryanyogan/klippy/compare/f-03...f-04)).

:::rabbithole
- read "Workers Logs" by="Cloudflare" url="https://developers.cloudflare.com/workers/observability/logs/workers-logs/"
- read "Query Builder" by="Cloudflare" url="https://developers.cloudflare.com/workers/observability/query-builder/"
:::
