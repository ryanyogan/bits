---
# sources (checked 2026-11-03):
# - AI SDK, Tool calling (tool(), description, inputSchema, execute; stopWhen; isStepCount, with
#   stepCountIs kept as an alias in ai 7) https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
# - Anthropic, Define tools (name + description + input schema; descriptions matter most)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Open-Meteo (free, no key, non-commercial use under 10,000 calls a day) https://open-meteo.com/en/docs
# - Klippy b-01 → b-02, recorded output docs/outputs/b-02.txt (2026-11-03, ai 7.0.162, zod 4.6.7).
#   The Workers AI fallback (@cf/zai-org/glm-4.7-flash) answered and called the tool, not Claude.
title: "Your first tool: the weather"
order: 2
minutes: 25
xp: 60
module: First tools
device: desk
tag: b-01
verified: 2026-11-03
versions:
  ai: "7.0.162"
  zod: "4.6.7"
  agents: "0.33.0"
  wrangler: "4.157.0"
---

Klippy can talk, but it can't look anything up. Ask it about the weather
and the best it can do is guess. In this lesson you'll write its first
tool, `getWeather`, which fetches live weather from a free service, and
let Claude decide when to call it.

### 1. One new package

Claude needs to know what arguments a tool takes. You'll describe them with
**zod**, a library for describing the shape of data in TypeScript. The AI
SDK turns a zod description into JSON Schema, the format Claude reads.

```sh
pnpm --filter agent add --save-exact zod@4.6.7
```

### 2. Describe the tool

A tool has three parts: a **description** in plain English, an **input
schema** for its arguments, and an **execute** function that does the work.
Claude only ever sees the first two. Make `apps/agent/src/tools/weather.ts`,
starting with the description and the schema:

:::code{file="apps/agent/src/tools/weather.ts" lang="ts" tag="b-02" highlight="5-9" label="apps/agent/src/tools/weather.ts"}
import { tool } from 'ai';
import { z } from 'zod';

// Open-Meteo is free and needs no key (non-commercial use, under 10,000 calls a day).
export const getWeather = tool({
	description: 'Get the current weather for a place.',
	inputSchema: z.object({
		place: z.string().describe('A city or town, e.g. "Berlin"'),
	}),
:::

- `tool({...})` comes from the AI SDK and bundles the three parts.
- The description is short on purpose for now. In lesson 4 you'll see why
  a better one changes what Claude does.
- `z.object({ place: z.string() })` says the input is an object with one
  string, `place`. `.describe(...)` is a note for Claude about that field,
  with an example of the format you want.

:::quiz{id="what-claude-reads" xp=20}
Claude has to decide whether a question needs `getWeather`. What does it go on?

- [ ] The code inside your execute function
  Not quite. Claude never sees your code, only the definition the AI SDK sends.
- [x] The tool's name, description and input schema
  Right. That's all it has, which is why the description matters so much.
- [ ] It tries the tool and sees what happens
  Not quite. Claude can't run anything. It can only ask your code to.
:::

### 3. Do the work

Now the part that runs when Claude asks. Add `execute` inside the
`tool({...})`, after `inputSchema`:

:::code{file="apps/agent/src/tools/weather.ts" lang="ts" tag="b-02" highlight="2-16" label="apps/agent/src/tools/weather.ts"}
	execute: async ({ place }) => {
		// 1. Turn the place name into coordinates.
		const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`);
		const hit = geo.results?.[0];
		if (!hit) return { error: `I couldn't find a place called ${place}.` };

		// 2. Ask for the current weather there.
		const { current } = await getJson(
			`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
		);
		return {
			place: `${hit.name}, ${hit.country}`,
			temperatureC: current.temperature_2m,
			windKmh: current.wind_speed_10m,
			conditions: describeWeather(current.weather_code),
		};
	},
});
:::

- Open-Meteo is free and needs no key. It works in two steps: turn a place
  name into coordinates (geocoding), then ask for the weather there.
- A place it can't find returns `{ error: ... }` as a normal result. Claude
  reads it and tells the user, instead of the request failing.
- The result is a small object with just what's needed: Claude reads every
  field you return, and every field costs tokens.

Two helpers finish the file. Add them at the bottom:

:::code{file="apps/agent/src/tools/weather.ts" lang="ts" tag="b-02" label="apps/agent/src/tools/weather.ts"}
async function getJson(url: string) {
	const response = await fetch(url);
	return response.json<any>();
}

// Open-Meteo sends a WMO weather code. These are the main groups.
function describeWeather(code: number) {
	if (code === 0) return 'clear sky';
	if (code <= 3) return 'partly cloudy';
	if (code <= 48) return 'fog';
	if (code <= 57) return 'drizzle';
	if (code <= 67) return 'rain';
	if (code <= 77) return 'snow';
	if (code <= 82) return 'rain showers';
	if (code <= 86) return 'snow showers';
	return 'thunderstorm';
}
:::

`getJson` fetches a URL and reads the JSON. `describeWeather` turns
Open-Meteo's numeric weather code into words. Lesson 7 makes `getJson`
honest about failures.

### 4. Hand Klippy the tool

In `apps/agent/src/ask.ts`, import the tool and give it to `generateText`:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-02" highlight="10-12" label="apps/agent/src/ask.ts"}
import { generateText, isStepCount } from 'ai';
import { model } from './model';
import { getWeather } from './tools/weather';
// ...
	const { text, providerMetadata } = await generateText({
		model: model(env),
		system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
		messages: [{ role: 'user', content: question }],
		maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
		tools: { getWeather },
		// Step 1: Claude may call a tool. Step 2: it answers with the result. Then stop.
		stopWhen: isStepCount(2),
	});
:::

- `tools: { getWeather }` sends the tool's description and schema to the
  model with every request. The key, `getWeather`, is the name Claude uses.
- `stopWhen: isStepCount(2)` is the important new line. With a tool,
  one question can take two model calls, called **steps**: in step 1, Claude
  asks for the tool and the SDK runs it; in step 2, Claude answers with the
  result. Then it stops, whatever happens, so a confused model can't loop
  and run up your bill. (Older code calls it `stepCountIs`; in `ai` 7 that's
  an alias of `isStepCount`.)

### 5. Ask about the weather

With `pnpm dev` running, ask with your token (from Your first Worker,
in `apps/agent/.dev.vars`):

```sh
curl -s -X POST http://localhost:8787/ask -H "Authorization: Bearer $KLIPPY_TOKEN" -d '{"question":"What is the weather in Berlin right now?"}'
```

Run `export KLIPPY_TOKEN=...` with your token first, or paste it in place of
`$KLIPPY_TOKEN`. Here's ours:

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;What is the weather in Berlin right now?&quot;}'"}
{"answer":"It's currently 5.6°C in Berlin with partly cloudy skies and light winds of 7.1 km/h.","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;Is it raining in Llanfairpwllgwyngyll?&quot;}'"}
{"answer":"No, it's not raining in Llanfairpwllgwyngyll; the weather is partly cloudy with a temperature of 8.7°C.","model":"[synapse]@cf/zai-org/glm-4.7-flash[text]"}
:::

Those numbers are real: they came from Open-Meteo on 3 November 2026. The
answers were written by the free fallback model (see `model`), since our
gateway has no Anthropic key. With yours, Claude writes them.

If the answer guesses instead of giving numbers, check that `tools: {
getWeather }` is in `ask.ts` and that the dev server reloaded. If it's
empty, the model ran out of steps: check `isStepCount(2)`.

### 6. Tests that don't call anyone

Klippy's tests fake two things: the model, which "decides" to call
`getWeather` and then answers, and Open-Meteo, so no request leaves your
machine. They check that the tool's result is what goes back to the model.
Copy [`test/weather.spec.ts`](https://github.com/ryanyogan/klippy/blob/b-02/apps/agent/test/weather.spec.ts)
and the updated [`test/fake-model.ts`](https://github.com/ryanyogan/klippy/blob/b-02/apps/agent/test/fake-model.ts)
from the repo, then run `pnpm test`. Ours: 16 passed.

One habit for the whole course: each lesson's tests live in the repo at that
lesson's tag, and earlier test files sometimes grow too. The simplest way to
stay in step is to copy the whole `apps/agent/test/` folder from the tag at
the end of each lesson.

Commit. Your code matches tag `b-02`
([changes from b-01](https://github.com/ryanyogan/klippy/compare/b-01...b-02)).

:::rabbithole
- read "Tool calling" by="AI SDK" url="https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling"
- read "Define tools" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
:::
