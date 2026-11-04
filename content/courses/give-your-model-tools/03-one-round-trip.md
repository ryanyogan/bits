---
# sources (checked 2026-11-03):
# - Anthropic, How tool use works (tool_use with an id, tool_result with tool_use_id, the loop
#   runs in your code for client tools) https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
# - AI SDK, generateText: steps, onStepEnd (onStepFinish is a deprecated alias in ai 7), finishReason
#   https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
# - Klippy b-02 → b-03, recorded output docs/outputs/b-03.txt (2026-11-03, ai 7.0.162). The Workers AI
#   fallback answered, not Claude.
title: "Watch one round trip"
order: 3
minutes: 15
xp: 50
module: First tools
device: desk
tag: b-02
verified: 2026-11-03
versions:
  ai: "7.0.162"
  wrangler: "4.157.0"
---

Klippy answered with real weather, but you didn't see how. One `curl` became
two model calls and a trip to Open-Meteo, all hidden inside `generateText`.
In this lesson you'll log each step, so you can watch the round trip
happen.

### 1. Log each step

`generateText` can call a function at the end of every step. Add
`onStepEnd` to the call in `apps/agent/src/ask.ts`, after `stopWhen`:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-03" highlight="4-16" label="apps/agent/src/ask.ts"}
		tools: { getWeather },
		// Step 1: Claude may call a tool. Step 2: it answers with the result. Then stop.
		stopWhen: isStepCount(2),
		// Log one line per step, so you can watch the round trip in the `pnpm dev` terminal.
		onStepEnd: (step) => {
			console.log(
				JSON.stringify({
					step: step.stepNumber,
					finish: step.finishReason, // "tool-calls": Claude wants a tool. "stop": it answered.
					toolCalls: step.toolCalls.map((call) => ({ tool: call.toolName, input: call.input })),
					toolResults: step.toolResults.map((result) => ({ tool: result.toolName, output: result.output })),
					text: step.text,
					tokens: step.usage.totalTokens,
				}),
			);
		},
	});
:::

- `step.stepNumber` counts from 0.
- `step.finishReason` says why the step ended: `tool-calls` means the model
  asked for a tool; `stop` means it answered.
- `toolCalls` and `toolResults` are what the model asked for and what your
  code sent back.
- `step.usage.totalTokens` is what that step cost, in tokens.
- `JSON.stringify` puts each step on one line, easy to read and to search.

(Older examples use `onStepFinish`. In `ai` 7 that's a deprecated alias of
`onStepEnd`.)

### 2. Watch it

Ask about the weather again, then look at the terminal running `pnpm dev`.
Here's what we saw (reply in the second terminal, the two log lines in the
first):

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;What is the weather in Lisbon?&quot;}'"}
{"answer":"The current weather in Lisbon, Portugal is 14.7°C with light winds of 10.4 km/h and clear skies.","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

:::terminal{cmd="pnpm dev"}
[ion]{"step":0,"finish":"tool-calls"[text],"toolCalls":[{"tool":"getWeather","input":{"place":"Lisbon"}}],"toolResults":[{"tool":"getWeather","output":{"place":"Lisbon, Portugal","temperatureC":14.7,"windKmh":10.4,"conditions":"clear sky"}}],"text":"I'll get the current weather information for Lisbon for you.","tokens":246}
[volt]{"step":1,"finish":"stop"[text],"toolCalls":[],"toolResults":[],"text":"The current weather in Lisbon, Portugal is 14.7°C with light winds of 10.4 km/h and clear skies.","tokens":317}
[muted][wrangler:info] POST /ask 200 OK (7390ms)
:::

Read it line by line. This is the whole idea of tool use:

1. **Step 0.** The model read the question and the tool's description,
   and asked for `getWeather` with `{ place: "Lisbon" }`. The step ended
   with `tool-calls`.
2. **Your code ran.** The SDK saw the request, ran your `execute`, and got
   the weather back from Open-Meteo. That's `toolResults`.
3. **Step 1.** The SDK called the model again with everything so far: the
   question, the model's request and your result. The model wrote the
   answer, and the step ended with `stop`.

Two details worth noticing. Step 0 also had some text ("I'll get the
current weather…"), but your reply only has step 1's: `generateText`
returns the last step's text. And step 1 cost more tokens than step 0,
because each step sends the whole conversation again, now with the tool
result in it. The model remembers nothing between calls.

The model here is the free fallback, as before. Claude follows the same
two steps.

### 3. What's on the wire

Under the AI SDK, Claude's API does this with two kinds of block. In step
0, Claude's reply holds a `tool_use` block with an `id`, like `toolu_01`,
the tool's name and its input. In step 1, your result goes back as a
`tool_result` block that quotes that id as `tool_use_id`. The SDK writes
both for you, but when you read Claude's docs or debug a raw request,
that's what you'll see.

:::quiz{id="matching-id" xp=20}
Claude asks for two tools in one step. How does it know which result answers which call?

- [ ] Results are matched by the order they arrive in
  Not quite. Order isn't what links them.
- [x] Each tool_result's tool_use_id matches the id of its tool_use block
  Right. Every call has an id, and its result quotes it back.
- [ ] Each tool_result repeats the tool's name
  Not quite. A tool_result has no name field. The id does the matching.
:::

If no JSON lines appear, check that `onStepEnd` is inside the object you
pass to `generateText`, and that you're looking at the `pnpm dev`
terminal, not the curl one.

Commit. Your code matches tag `b-03`
([changes from b-02](https://github.com/ryanyogan/klippy/compare/b-02...b-03)).

:::rabbithole
- read "How tool use works" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works"
- read "generateText reference" by="AI SDK" url="https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text"
:::
