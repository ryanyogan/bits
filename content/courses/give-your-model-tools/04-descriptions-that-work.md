---
# sources (checked 2026-10-27; Klippy steps 2026-11-03):
# - Anthropic, Define tools, "Best practices for tool definitions" (detailed descriptions are by
#   far the most important factor; say what it does, when to use it and when not, what each
#   parameter means, caveats; aim for 3–4 sentences or more; consolidate related operations;
#   namespace names by service; return only high-signal fields)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic Engineering, Writing effective tools for agents, 2025-09-11 (describe a tool as
#   you would to a new hire; unambiguous parameter names; Claude was appending "2025" to web
#   search queries until the description was fixed)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# - Klippy b-03 → b-04, recorded output docs/outputs/b-04.txt (2026-11-03). The Workers AI fallback
#   answered, not Claude. The recording ran after midnight UTC, so Tokyo and Oslo read 4 November.
# Compare toy: illustrative. The prompt exercise is a stand-in: the sandbox has no tools, so
# Claude reports the call it would make rather than making one.
title: "Descriptions Claude follows"
order: 4
minutes: 25
xp: 70
module: First tools
device: desk
tag: b-03
verified: 2026-11-03
versions:
  ai: "7.0.162"
  zod: "4.6.7"
---

Anthropic's own advice on tools is blunt: the description is **by far the
most important factor** in how well Claude uses a tool. Claude can't read
your code or ask you what you meant. The description is the whole briefing.

A good test: write it the way you'd brief a **new hire** who has never seen
your system. Spell out what the tool does, **when to use it and when not
to**, what each input means, and what it doesn't do. That's usually three or
four sentences, more for a complicated tool.

:::compare{left="Thin description" right="Briefing" illustrative}
- prompt "search_orders: what Claude is told"
- left "Searches orders."
- right "Find a customer's orders by email address, newest first. Use it when the user asks about a past purchase, a delivery or a refund. It can't change or cancel orders. Returns at most 10 orders with id, date, status and total."
- prompt "User asks: “Where's the blender I bought last week? It's jo@example.com”"
- left "Claude guesses: is the email the search term, or an order id? Will results be in date order?"
- right "Claude calls search_orders with { email: \"jo@example.com\" } and looks at the newest result."
:::

The thin version leaves Claude guessing: search by what? Which orders come
back? Can it cancel one? Every guess is a chance for a wrong call.

The same care goes into the **inputs**. Name them so they can't be misread:
`customer_email` beats `user`, which could be a name, an email or an id.
Give each one a description with an example of the format you want.

Small wording changes matter more than you'd think. When Anthropic launched
Claude's web search tool, Claude kept adding the year to search queries,
which skewed the results. The fix wasn't new code. It was a better
description.

### Try it in the sandbox

The sandbox has no real tools, so you'll do the next best thing: write a
**description** for a `get_weather` tool (what it does, when to use it, when
not to), then give Claude a user message and ask it to reply with **only the
input it would send**, as JSON, or “no tool”. Try a question that should use
the tool and one that shouldn't.

:::prompt{id="describe-and-pick" xp=40 coach}
Write a tool description, then ask what call Claude would make
- goal "Write a get_weather description good enough that Claude makes the right call for a user message: the exact input it would send, or no tool"
- placeholder "Tool get_weather: … Use it when … Don't use it for … User: “…” Reply with only the JSON input you'd send, or no tool."
- draft "Tool: get_weather. User: Should I bring an umbrella in Leeds tomorrow?"
- check "Says what the tool does" /weather|forecast|temperature/i
- check "Says when to use it" /\bwhen\b|use (it|this) (for|if)|whenever/i
- check "Says when not to" /\bnot\b|don.t|never|only for/i
- check "Asks for the JSON input" /json/i
- expect "Replies with a call or no tool" match /\{|no tool/i
- rubric "Claude's decision follows from what your description allows" must
- rubric "Any input it sends uses names and formats the description spells out" should
- rubric "The description names its inputs so they can't be misread, like city rather than q" should on=prompt
- hint "Claude decides from your words alone. Does your description say what the tool can't do as well as what it can?"
- hint "Check the user's message against the description. If they ask about tomorrow, does the tool cover tomorrow?"
- hint "Write three short lines (what it does, when to use it, what it can't do) and name its input, then add the user message."
- reference "Tool get_weather: returns the current temperature and conditions for one city. Input: city (the city name, with country if it's ambiguous, e.g. Leeds, UK). Use it when the user asks about the weather now. Don't use it for forecasts: it has no data about tomorrow.\n\nUser: “Should I bring an umbrella in Leeds tomorrow?”\n\nReply with only the JSON input you would send to get_weather, or the words no tool and one short reason."
- run temperature=[1.0]
- example T=1.0 "no tool. get_weather only returns current conditions, and the question is about tomorrow."
- example T=1.0 "no tool. The tool only gives current conditions, and you asked about tomorrow."
- example T=1.0 "no tool: the description says it has no data about tomorrow, so a call wouldn't answer the umbrella question."
- success "This is the decision Claude makes on every request. Your description is all it has to go on." next="Next: give Klippy the same care →"
:::

If your description says the tool only covers **right now**, a question
about tomorrow shouldn't use it. Claude follows the description you wrote,
including its limits.

### 1. A better getWeather

Klippy's `getWeather` still says only "Get the current weather for a
place." Brief it properly. In `apps/agent/src/tools/weather.ts`, replace the
description:

:::code{file="apps/agent/src/tools/weather.ts" lang="ts" tag="b-04" highlight="2-4" label="apps/agent/src/tools/weather.ts"}
export const getWeather = tool({
	// The description is a prompt: say what it returns, when to use it, and when not to.
	description:
		'Get the current weather (temperature, wind and conditions) for a city or town. Use it when the user asks about the weather right now or what to wear today. It has no forecasts and no past weather.',
	inputSchema: z.object({
		place: z.string().describe('A city or town, e.g. "Berlin"'),
	}),
:::

What it returns (temperature, wind, conditions), when to use it (the
weather now, what to wear today), and what it can't do (no forecasts, no
past weather). The last sentence is the one that stops a wrong call.

### 2. A second tool: the time

Models don't know what time it is. Their knowledge stops at a training
date, and nothing tells them today's date unless you do. Make
`apps/agent/src/tools/time.ts`:

:::code{file="apps/agent/src/tools/time.ts" lang="ts" tag="b-04" highlight="6-14" label="apps/agent/src/tools/time.ts"}
import { tool } from 'ai';
import { z } from 'zod';

// Models don't know what time it is. This tool tells them.
export const getTime = tool({
	description:
		"Get the current date and time in a time zone. Use it whenever the answer depends on today's date or the time somewhere: you don't know the current time otherwise.",
	inputSchema: z.object({
		timeZone: z.string().describe('An IANA time zone, e.g. "Europe/Berlin" or "America/New_York"'),
	}),
	execute: async ({ timeZone }) => ({
		timeZone,
		now: new Date().toLocaleString('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'short' }),
	}),
});
:::

- The description says when to use it ("whenever the answer depends on
  today's date or the time somewhere") and why ("you don't know the current
  time otherwise").
- `timeZone` is an IANA name like `Europe/Berlin`, the standard every
  computer uses. The example in `.describe` shows the format.
- `toLocaleString` with that `timeZone` gives the local date and time
  there. No outside service needed.

Then hand both tools to the model in `apps/agent/src/ask.ts`:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-04" highlight="6-6" label="apps/agent/src/ask.ts"}
import { generateText, isStepCount } from 'ai';
import { model } from './model';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';
// ...
		tools: { getWeather, getTime },
:::

### 3. Watch Claude choose

Three questions: one that needs no tool, one that needs the time, and one
that needs both. Here's what the step log showed us:

:::terminal{cmd="pnpm dev"}
[volt]{"step":0,"finish":"stop"[text],"toolCalls":[],"toolResults":[],"text":"2 + 2 = 4.","tokens":399}
[ion]{"step":0,"finish":"tool-calls"[text],"toolCalls":[{"tool":"getTime","input":{"timeZone":"Asia/Tokyo"}}],"toolResults":[{"tool":"getTime","output":{"timeZone":"Asia/Tokyo","now":"Wednesday, 4 November 2026 at 08:43"}}],"text":"","tokens":406}
[volt]{"step":1,"finish":"stop"[text],"toolCalls":[],"toolResults":[],"text":"It's 8:43 AM on Wednesday, November 4, 2026 in Tokyo.","tokens":466}
[ion]{"step":0,"finish":"tool-calls"[text],"toolCalls":[{"tool":"getWeather","input":{"place":"Oslo"}},{"tool":"getTime","input":{"timeZone":"Europe/Oslo"}}],"toolResults":[{"tool":"getWeather","output":{"place":"Oslo, Norway","temperatureC":3.8,"windKmh":2.2,"conditions":"partly cloudy"}},{"tool":"getTime","output":{"timeZone":"Europe/Oslo","now":"Wednesday, 4 November 2026 at 00:43"}}],"text":"","tokens":417}
[volt]{"step":1,"finish":"stop"[text],"toolCalls":[],"toolResults":[],"text":"Yes, it's a brisk 4°C and partly cloudy in Oslo right now, so a light jacket would be a good idea.","tokens":526}
:::

- "What is 2+2?" called nothing: one step, `stop`. Not every question
  needs a tool, and a good description makes that clear.
- "What time is it in Tokyo right now?" called `getTime` with the right
  zone.
- "Should I take a jacket in Oslo today?" called **both tools in one
  step**. That's a **parallel** call: the model asked for two things at
  once, the SDK ran both, and step 1 answered. That's why two steps are
  still enough.

As before, these came from the free fallback model, not Claude.

### 4. What a test can and can't check

Here's the honest limit: a fake model can't tell you whether your
descriptions work. Only a real model reading them can, which is what the
sandbox exercise above was for. What tests can check is your side of the
deal: that the model is shown both tools with real descriptions, and that
nothing runs unless the model asks. From
[`test/tools.spec.ts`](https://github.com/ryanyogan/klippy/blob/b-04/apps/agent/test/tools.spec.ts):

:::code{file="apps/agent/test/tools.spec.ts" lang="ts" tag="b-04" highlight="2-7" label="apps/agent/test/tools.spec.ts"}
	it("runs no tool when the model answers straight away (\"what's 2+2?\")", async () => {
		const fetch = vi.spyOn(globalThis, 'fetch');
		fake.model = fakeModel('2 + 2 is 4.');
		const response = await ask("What's 2+2?");
		expect(await response.json()).toEqual({ answer: '2 + 2 is 4.' });
		expect(fetch).not.toHaveBeenCalled();
		expect(fake.model.doGenerateCalls).toHaveLength(1);
	});
:::

`vi.spyOn(globalThis, 'fetch')` watches every outgoing request. The fake
model answers "2 + 2 is 4." straight away, and the test checks that no
fetch happened and the model was called once. Copy the file and run
`pnpm test`. Ours: 20 passed.

Commit. Your code matches tag `b-04`
([changes from b-03](https://github.com/ryanyogan/klippy/compare/b-03...b-04)).

:::rabbithole
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
- read "Define tools: best practices" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
:::
