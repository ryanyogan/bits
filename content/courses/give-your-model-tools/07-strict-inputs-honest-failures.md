---
# sources (checked 2026-11-03):
# - Anthropic, Strict tool use (strict: true guarantees the input matches the schema; all current
#   models) https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
# - Anthropic, Structured outputs, JSON Schema limitations (no minLength/maxLength/minimum/maximum
#   in strict schemas) https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# - Anthropic, Handle tool calls: errors go back as a tool_result with is_error
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
# - AI SDK, Tool calling: tool errors (tool-error parts; AI_InvalidToolInputError), strict per tool
#   https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
# - agents 0.33.0 createAI sends only name, description and parameters for each tool (strict is
#   dropped; read in node_modules/agents/dist on 2026-11-03), so Klippy doesn't set strict.
# - Klippy b-06 → b-07, recorded output docs/outputs/b-07.txt (2026-11-03). The Workers AI fallback
#   answered, not Claude.
title: "Strict inputs, honest failures"
order: 7
minutes: 25
xp: 70
module: Getting calls right
device: desk
tag: b-06
verified: 2026-11-03
versions:
  ai: "7.0.162"
  zod: "4.6.7"
  agents: "0.33.0"
---

Tools go wrong in two ways. The model sends **bad input**, like a time zone
that doesn't exist. Or the input is fine and **the call fails**: the
weather service is down. In both cases the worst thing Klippy can do is
crash, or make something up. The right thing is to tell the model what went
wrong, so it can tell the user. In this lesson you'll make both failures
honest.

### 1. Input the schema can't describe

`getTime` takes a `timeZone` string. Ask for the time in
"Mars/Olympus_Mons" and that's a string, so the schema lets it through, and
`toLocaleString` throws. A schema can say "a string"; it can't say "a real
time zone". So add a check that runs in your code. In
`apps/agent/src/tools/time.ts`, replace the schema:

:::code{file="apps/agent/src/tools/time.ts" lang="ts" tag="b-07" highlight="2-6" label="apps/agent/src/tools/time.ts"}
	inputSchema: z.object({
		timeZone: z
			.string()
			.describe('An IANA time zone, e.g. "Europe/Berlin" or "America/New_York"')
			// The schema Claude sees says "a string". This check runs in your code, after Claude calls.
			.refine(isTimeZone, 'Not an IANA time zone. Use a name like "Europe/Berlin".'),
	}),
:::

and add the check at the bottom of the file:

:::code{file="apps/agent/src/tools/time.ts" lang="ts" tag="b-07" highlight="1-8" label="apps/agent/src/tools/time.ts"}
function isTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone });
		return true;
	} catch {
		return false; // Intl throws a RangeError for a zone it doesn't know
	}
}
:::

- `.refine(isTimeZone, message)` runs `isTimeZone` on the value after the
  model calls. If it returns `false`, the input is rejected and `execute`
  never runs.
- `Intl.DateTimeFormat` throws for a zone it doesn't know, which makes it a
  handy test.
- The message is written **for the model**: what was wrong and what to
  send instead ("Use a name like Europe/Berlin"). A good error is a hint.

The AI SDK doesn't stop when input is rejected. It sends the error back to
the model as the tool's result (Claude's API marks it `is_error`), and the
model gets its next step to fix the call or explain.

### 2. A call that fails

Right now, if Open-Meteo answers with an error page, `getJson` tries to
read it as JSON and Klippy fails in a confusing way. Check the status first.
In `apps/agent/src/tools/weather.ts`:

:::code{file="apps/agent/src/tools/weather.ts" lang="ts" tag="b-07" highlight="3-4" label="apps/agent/src/tools/weather.ts"}
async function getJson(url: string) {
	const response = await fetch(url);
	// A failed call is a result too: throw, and Claude is told the tool failed, so it can say so honestly.
	if (!response.ok) throw new Error(`The weather service is not answering (HTTP ${response.status}). Try again later.`);
	return response.json<any>();
}
:::

`response.ok` is false for any 4xx or 5xx status. **Throwing** here is
right: the AI SDK catches it, and the model is told the tool failed, with
your message. It can then say "the weather service isn't answering"
instead of inventing a forecast.

### 3. See the errors in your log

Add one field to the step log in `apps/agent/src/ask.ts`, after
`toolResults`:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-07" highlight="2-3" label="apps/agent/src/ask.ts"}
					toolResults: step.toolResults.map((result) => ({ tool: result.toolName, output: result.output })),
					// A failed tool call (bad input, or a service that's down) goes back to Claude as an error.
					toolErrors: step.content.flatMap((part) => (part.type === 'tool-error' ? [{ tool: part.toolName, error: String(part.error) }] : [])),
:::

A failed call doesn't appear in `toolResults`; it's a `tool-error` part of
the step. This pulls them out, one per failed tool.

Now ask for the time on Mars. Our run:

:::terminal{cmd="pnpm dev"}
[ion]{"step":0,"finish":"tool-calls"[text],"toolCalls":[{"tool":"getTime","input":{"timeZone":"Mars/Olympus_Mons"}}],"toolResults":[],[synapse]"toolErrors":[{"tool":"getTime","error":"AI_InvalidToolInputError: Invalid input for tool getTime: AI_TypeValidationError: Type validation failed: Value: {\"timeZone\":\"Mars/Olympus_Mons\"}.\nError message: [\n  {\n    \"code\": \"custom\",\n    \"path\": [\n      \"timeZone\"\n    ],\n    \"message\": \"Not an IANA time zone. Use a name like \\\"Europe/Berlin\\\".\"\n  }\n]"}][text],"text":"","tokens":645}
[volt]{"step":1,"finish":"stop"[text],"toolCalls":[],"toolResults":[],"toolErrors":[],"text":"The time zone \"Mars/Olympus_Mons\" isn't a valid IANA time zone that my tool recognizes. I can only provide times for authoritative timezone databases like those for Earth. For Mars, you'd need a specialized Mars timekeeping system not available in this tool.","tokens":817}
:::

Step 0: the model sent the bad zone, your refinement refused it, and the
error went back. Step 1: the model read the error and told the truth. (The
free fallback model again; Claude does the same with the same error.)

Klippy's [`test/failures.spec.ts`](https://github.com/ryanyogan/klippy/blob/b-07/apps/agent/test/failures.spec.ts)
checks both: a bad zone never reaches `execute`, and a 502 from the weather
service comes back to the model as an error. Ours: 27 passed.

### Write an error Claude can use

The sandbox can't run your tools, but it can show what a good error does.
Write the error your weather tool would return for a misspelled city, and
ask Claude what it does next.

:::prompt{id="helpful-error" xp=30 coach}
Write a tool error that tells Claude what to try next
- goal "Write the error your weather tool returns for a misspelled city, so well that Claude's next step is obvious and right"
- placeholder "Your get_weather call returned this error: “…” In one sentence, what do you do next?"
- draft "Your tool call returned: Error 404. What next?"
- check "Says it's a tool error" /error|failed|is_error/i
- check "Asks what Claude would do" /what (would|do|will) you|next/i
- expect "Answers in a sentence or two" sentences<=2
- rubric "The error says what went wrong and what to try instead" must on=prompt
- rubric "Claude's next step follows from your error's suggestion, not from a guess" must evidence
- rubric "Claude doesn't make up the weather" should
- hint "Read your error as Claude would. Does it say what went wrong, or only that something did?"
- hint "A good error is a hint: what failed, and one thing to try next."
- hint "Name the city that wasn't found, suggest a likely spelling or adding the country, then ask Claude what it would do next."
- reference "Your get_weather call returned this error, as a tool_result with is_error: “No city called Pariss. Did you mean Paris, France? Try again with the corrected spelling and the country.”\n\nIn one sentence, what do you do next?"
- run temperature=[1.0]
- example T=1.0 "I'd call get_weather again with \"Paris, France\", since \"Pariss\" looks like a typo."
- example T=1.0 "I'd retry the lookup with the corrected spelling, Paris, and add the country to be safe."
- example T=1.0 "I'd ask the user whether they meant Paris, France, then call the tool again with that."
- success "A useful error is a hint. Claude recovers instead of guessing." next="Next: read a link →"
:::

### What about strict?

Claude also offers **strict tool use**: mark a tool `strict: true` and
Claude's input is guaranteed to match your schema: the right types, every
required field, only allowed enum values. The AI SDK has a `strict` option
per tool for it.

Two honest notes. First, strict guards the **shape**, not the meaning: a
strict `timeZone` is still a string, and "Mars/Olympus_Mons" still fits.
Strict schemas also can't use limits like a maximum length, so checks like
`.max(1000)` on a note and `.refine` on a zone stay in your code either way.
Second, Klippy doesn't set `strict`, because the version of the Agents SDK
it uses (0.33.0) doesn't pass that flag on to the model. A flag that does
nothing would mislead you. Your code's own checks are what Klippy relies
on, and they work with any model.

:::quiz{id="what-strict-does" xp=20}
What does strict tool use guarantee?

- [ ] That Claude calls the tool
  Not quite. Whether to call is still Claude's decision (or toolChoice's).
- [x] That the tool's input matches your schema
  Right. Types, required fields and enums all hold, so your code can trust the input's shape.
- [ ] That the input is correct
  Not quite. A valid shape can still hold the wrong city, or a time zone on Mars. Strict guards the format, not the facts.
:::

Commit. Your code matches tag `b-07`
([changes from b-06](https://github.com/ryanyogan/klippy/compare/b-06...b-07)).

:::rabbithole
- read "Strict tool use" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use"
- read "Handle tool calls: errors" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"
:::
