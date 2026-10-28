---
# sources (checked 2026-10-27):
# - Anthropic, Tool use with Claude / Handle tool calls / Parallel tool use / Strict tool use
#   (everything the bot does: tool definition, one round trip, every result in one message,
#   is_error, strict: true)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
# - Open-Meteo docs (geocoding + forecast APIs, current=temperature_2m,weather_code,
#   wind_speed_10m; WMO weather codes; free for non-commercial use, under 10,000 calls a day,
#   no API key) https://open-meteo.com/en/docs and https://open-meteo.com/en/terms
# - The bot's code was type-checked against @anthropic-ai/sdk 1.3.0 and its getWeather function
#   run against Open-Meteo on 2026-10-27 ("Pariss" geocodes to Périsse, Haiti; an unknown name
#   returns no results). The Claude calls were not run live while writing.
# Terminal block: example output written for this lesson, not a recorded run.
title: "Checkpoint: a weather bot"
order: 10
minutes: 10
xp: 100
module: Real-world calls
project: true
---

Time to put the course together. You're building a **weather bot** in
TypeScript: one question in, one answer out, backed by real weather data. It
uses everything you've learned. A tool with a description that says when
**not** to use it. A strict schema. One round trip. Every call answered, in
one message. Errors sent back with `is_error`.

The weather comes from **Open-Meteo**, which is free for non-commercial use
and needs no key. You only need an Anthropic API key in `ANTHROPIC_API_KEY`.

:::code{file="weather-bot.ts" lang="ts" copy highlight="71-100" label="the round trip"}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather for one city: temperature in °C, the sky and the wind. " +
      "Use it whenever the user asks about weather, temperature or what to wear outdoors " +
      "right now, once for each city. It has no forecasts or history, so don't use it " +
      "for tomorrow or last week.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City name, with the country if it's ambiguous, e.g. Paris, France",
        },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
];

const SYSTEM =
  "You are a friendly weather assistant. Answer in one or two sentences. " +
  "Use get_weather for current conditions and never guess the weather.";

// WMO weather codes (Open-Meteo docs), the common ones.
const SKY: Record<number, string> = {
  0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog",
  51: "drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 80: "showers", 95: "thunderstorm",
};

// The tool: Open-Meteo's free API, no key needed (non-commercial use).
async function getWeather(city: string) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`,
  );
  const place = (await geo.json()).results?.[0];
  if (!place) {
    throw new Error(`No city called "${city}". Check the spelling, or try a nearby larger city.`);
  }
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
      `&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
  );
  if (!res.ok) throw new Error(`The weather service failed (HTTP ${res.status}). Try again later.`);
  const { current } = await res.json();
  return {
    city: `${place.name}, ${place.country}`,
    temp_c: current.temperature_2m,
    sky: SKY[current.weather_code] ?? "mixed",
    wind_kmh: current.wind_speed_10m,
  };
}

function printText(reply: Anthropic.Message) {
  for (const block of reply.content) if (block.type === "text") console.log(block.text);
}

const question = process.argv[2] ?? "Do I need a coat in Chicago?";
const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
const ask = () =>
  client.messages.create({ model: "claude-haiku-5-5", max_tokens: 4096, system: SYSTEM, tools, messages });

// Request one: Claude reads the question and the tool, and decides.
const first = await ask();
if (first.stop_reason !== "tool_use") {
  printText(first); // no tool needed
  process.exit(0);
}

// Run every call (there may be several), and answer every call.
const calls = first.content.filter((block) => block.type === "tool_use");
const results = await Promise.all(
  calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
    const { city } = call.input as { city: string };
    console.error(`→ get_weather("${city}")`);
    try {
      const weather = await getWeather(city);
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(weather) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { type: "tool_result", tool_use_id: call.id, content: message, is_error: true };
    }
  }),
);

// Request two: Claude's reply as it came, then every result in one message.
messages.push({ role: "assistant", content: first.content }, { role: "user", content: results });
const second = await ask();
printText(second);
if (second.stop_reason === "tool_use") {
  console.error("(Claude wants another call. Looping comes in Your first agent loop.)");
}
:::

:::code{file="setup.sh" lang="sh" copy}
npm init -y && npm pkg set type=module
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY=sk-ant-…   # from platform.claude.com
:::

:::terminal{cmd='npx tsx weather-bot.ts "Is it warmer in Paris or Tokyo right now?"'}
[muted]example output, written for this lesson (not a live run)
[quiet]→ get_weather("Paris, France")
[quiet]→ get_weather("Tokyo, Japan")
Tokyo is warmer right now: 18°C and partly cloudy, against 10°C and clear in Paris.
:::

Read it top to bottom and you'll recognise every part. Two calls came back
for Paris and Tokyo in **one** reply, ran side by side, and went back in
**one** message.

The tool also returns the place it **actually found**, not just the
temperature. That matters. Open-Meteo matches names loosely: ask it for
“Pariss” and it finds Périsse, in Haiti. Because the result says
`"Périsse, Haiti"`, Claude can spot the mismatch and say so, instead of
cheerfully reporting Caribbean weather for Paris.

:::quiz{id="no-city" xp=20}
Someone asks about the weather in “Xyzzyville”. Open-Meteo finds nothing. What does the bot do?

- [ ] It crashes on the missing result
  Not quite. getWeather throws, but the catch turns it into a tool_result.
- [x] It sends the error back with is_error, and Claude tells the user it couldn't find the city
  Right. The error message even suggests what to try, so Claude can pass that on.
- [ ] Claude makes up a temperature
  Not quite. Claude gets the error, and the system prompt tells it never to guess.
:::

:::quiz{id="tomorrow" xp=20}
Someone asks “Will it rain in Leeds tomorrow?”. What should a good run look like?

- [ ] Claude calls get_weather for Leeds and reports today's weather as tomorrow's
  Not quite. That's the mistake the description is there to prevent.
- [x] Claude doesn't call the tool, and says it can only see current conditions
  Right. The description says it has no forecasts, so the honest answer is to say so.
- [ ] The API rejects the request
  Not quite. Nothing here is an API error. It's Claude's decision, guided by your description.
:::

---

Last step. The description is the part that decides everything, so test
yours. Write a `get_weather` description that covers what it does, when to
use it and what it can't do, then ask Claude to say **tool** or **no tool**
for the three messages in the draft. The sandbox has no tools, so Claude is
telling you its decision rather than making the call. It's the same
judgement, from the same description.

:::prompt{id="test-the-description" xp=60}
Write the bot's tool description, then test it on three messages

- placeholder "Tool get_weather: … Use it when … It can't … For each message below, reply tool or no tool: …"
- draft "Messages: 1) Weather in Lima right now? 2) What's the capital of Peru? 3) Will it rain in Cusco tomorrow? For each, reply tool or no tool."
- check "Names the tool"               /get_weather/i
- check "Says what it does"            /temperature|conditions|sky|the weather for/i
- check "Says when to use it"          /\bwhen\b|whenever|use (it|this) (for|if)/i
- check "Says what it can't do"        /no forecast|not (for )?forecast|can.t|cannot|doesn.t|does not|only current/i
- check "Keeps the three messages"     /lima/i
- check "Keeps the three messages"     /peru/i
- check "Keeps the three messages"     /cusco/i
- run temperature=[1.0]
- example T=1.0 "1) tool: get_weather {\"city\": \"Lima, Peru\"} 2) no tool, I know that one: Lima. 3) no tool: it only has current conditions, not forecasts."
- example T=1.0 "1) tool 2) no tool 3) no tool, since get_weather can't forecast tomorrow."
- example T=1.0 "1) tool, city Lima. 2) no tool. 3) no tool: the description rules out forecasts, so I'd tell the user I can't check tomorrow's weather."
- success "Two out of three need no tool, and Claude knew it from your words alone." next="Finish the course →"
:::

That's a working tool-using bot. It answers one question with at most one
round of tool calls. If Claude wants a second round (look up the city,
**then** the weather, **then** a packing list), the bot stops and says so.

Handling that is a later course, **Your first agent loop**. You'll wrap
this round trip in a loop that keeps going until Claude has what it needs,
and learn how to stop it when it doesn't.

:::rabbithole
- read "Tool use with Claude" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview"
- read "Open-Meteo weather API docs" by="Open-Meteo" url="https://open-meteo.com/en/docs"
- read "Tool Calling With Vercel's AI SDK" by="Matt Pocock (AI Hero)" deep url="https://www.aihero.dev/tool-calls-with-vercel-ai-sdk"
:::
