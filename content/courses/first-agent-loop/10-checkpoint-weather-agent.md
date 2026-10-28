---
# sources (checked 2026-10-27):
# - Everything from lessons 1-9 (Anthropic: Building effective agents; Define tools; Handle
#   tool calls; Parallel tool use; Stop reasons; Context engineering; Preserved thinking).
# - Anthropic docs, Tool runner (beta; betaZodTool + client.beta.messages.toolRunner;
#   max_iterations; a tool that throws goes back as an is_error result; runner.done())
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner
# - Open-Meteo geocoding + forecast APIs (free for non-commercial use, no key; terms checked
#   2026-10-27) https://open-meteo.com/en/docs  https://open-meteo.com/en/terms
# - Code typechecked against @anthropic-ai/sdk 1.3.0 (zod 3.25 for the runner), and tools.ts
#   run against Open-Meteo on 2026-10-27. The model was not called: the chat transcript is
#   example output. Its numbers are the real Open-Meteo forecast for Chicago fetched that day
#   (Wed: high 75.7, low 50.1, rain 2%, wind 11 mph; Thu: high 67.1, low 57.1, rain 18%,
#   wind 11.1 mph); Claude's wording is illustrative.
title: "Checkpoint: a weather agent"
order: 10
minutes: 10
xp: 80
module: Shipping it
project: true
---

Time to put it all together. You're shipping a weather agent you can chat
with. It finds the city, fetches a real forecast, remembers the conversation,
stops itself when something goes wrong, and logs every turn.

It gets the weather from Open-Meteo: free for non-commercial use, no key
needed. There are three files. `tools.ts` holds the two tools from lesson 6,
`agent.ts` is the loop with lesson 9's limits and logs, and `chat.ts` keeps
lesson 8's memory.

:::code{file="agent.ts" lang="ts" copy highlight="20-41" label="the loop, with limits"}
import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools";

const client = new Anthropic();
const MAX_TURNS = 8;
const TOKEN_BUDGET = 60_000; // input + output, summed over turns
const run = crypto.randomUUID().slice(0, 8);

// Built once per process: keep system and tools fixed, only append.
const system = `Today is ${new Date().toDateString()}. You are a weather
assistant. Use the tools for every forecast; never guess the weather.
Only batch tool calls that are independent of each other. Answer in two
or three sentences. If a tool fails, say what you couldn't find instead
of making it up.`;

export async function agent(history: Anthropic.MessageParam[], task: string) {
  history.push({ role: "user", content: task });
  let spent = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (spent > TOKEN_BUDGET) return `Stopped: over ${TOKEN_BUDGET} tokens.`;
    const started = Date.now();
    const res = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      system,
      tools,
      messages: history,
    });
    history.push({ role: "assistant", content: res.content });
    spent += res.usage.input_tokens + res.usage.output_tokens;
    const calls = res.content.filter((b) => b.type === "tool_use");
    log({ turn, stop: res.stop_reason, calls: calls.map((c) => c.name), spent, ms: Date.now() - started });

    if (res.stop_reason === "end_turn") return textOf(res);
    if (res.stop_reason !== "tool_use") return `Stopped: ${res.stop_reason}.`;

    const results = await Promise.all(calls.map(runTool));
    history.push({ role: "user", content: results });
  }
  return `Stopped: no answer after ${MAX_TURNS} turns.`;
}

function textOf(res: Anthropic.Message) {
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

function log(fields: Record<string, unknown>) {
  console.error(JSON.stringify({ at: new Date().toISOString(), run, ...fields }));
}
:::

:::code{file="tools.ts" lang="ts" copy}
import type Anthropic from "@anthropic-ai/sdk";

type Input = Record<string, any>;
type Tool = { definition: Anthropic.Tool; run: (input: Input) => Promise<unknown> };

const geocode: Tool = {
  definition: {
    name: "geocode",
    description:
      "Look up a city's latitude and longitude by name. Call it before " +
      "get_forecast. Pass the city name only, like 'Chicago' or 'Lyon'. " +
      "Returns the best match with its country, so you can check the place.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "City name only" } },
      required: ["city"],
      additionalProperties: false,
    },
    strict: true,
  },
  async run({ city }) {
    const data = await getJson("https://geocoding-api.open-meteo.com/v1/search", {
      name: city,
      count: "1",
    });
    const place = data.results?.[0];
    if (!place) {
      throw new Error(`No place called "${city}". Check the spelling or try a nearby city.`);
    }
    const { name, country, latitude, longitude } = place;
    return { name, country, latitude, longitude };
  },
};

const getForecast: Tool = {
  definition: {
    name: "get_forecast",
    description:
      "Daily forecast for a latitude and longitude from geocode. For each " +
      "day: the high and low, the top chance of rain (%) and the top wind " +
      "speed (mph). Day 1 is today; 7 days at most. No hourly detail, no " +
      "past weather.",
    input_schema: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        days: { type: "integer", description: "1 to 7. Day 1 is today." },
        units: { type: "string", enum: ["fahrenheit", "celsius"] },
      },
      required: ["latitude", "longitude", "days", "units"],
      additionalProperties: false,
    },
    strict: true,
  },
  async run({ latitude, longitude, days, units }) {
    const { daily } = await getJson("https://api.open-meteo.com/v1/forecast", {
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
      forecast_days: String(Math.min(Math.max(days, 1), 7)),
      temperature_unit: units,
      wind_speed_unit: "mph",
      timezone: "auto",
    });
    return daily.time.map((date: string, i: number) => ({
      date,
      high: daily.temperature_2m_max[i],
      low: daily.temperature_2m_min[i],
      rain_pct: daily.precipitation_probability_max[i],
      wind_mph: daily.wind_speed_10m_max[i],
    }));
  },
};

async function getJson(url: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Weather service error ${res.status}. Try once more, then say it's down.`);
  return res.json();
}

const all = [geocode, getForecast];
export const tools = all.map((t) => t.definition);
const byName = new Map(all.map((t) => [t.definition.name, t]));

export async function runTool(
  block: Anthropic.ToolUseBlock,
): Promise<Anthropic.ToolResultBlockParam> {
  try {
    const tool = byName.get(block.name);
    if (!tool) throw new Error(`There is no tool called "${block.name}".`);
    const result = await tool.run(block.input as Input);
    return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "tool_result", tool_use_id: block.id, content: message, is_error: true };
  }
}
:::

:::code{file="chat.ts" lang="ts" copy}
import * as readline from "node:readline/promises";
import type Anthropic from "@anthropic-ai/sdk";
import { agent } from "./agent";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history: Anthropic.MessageParam[] = []; // the agent's memory

while (true) {
  const question = await rl.question("you › ");
  if (!question.trim()) break;
  console.log(await agent(history, question));
}
rl.close();
:::

:::terminal{cmd="npx tsx chat.ts 2> run.log"}
[quiet]you › [text]Should I bike to work in Chicago tomorrow? I leave at 8.
Tomorrow looks dry in Chicago (2% chance of rain) with wind up to 11 mph and a low near 50°F, so it'll be cool at 8. Bike, and bring a layer.
[quiet]you › [text]And the day after?
Thursday's low is milder at 57°F, but the chance of rain rises to 18%. Still a fine day to bike; pack a light jacket.
[quiet]you ›
:::

That transcript is **example output**. The numbers come from a real
Open-Meteo forecast for Chicago, fetched on 27 October 2026, but Claude's
wording is illustrative, and your forecast will differ. To run it yourself,
`npm i @anthropic-ai/sdk`, set `ANTHROPIC_API_KEY`, and use `npx tsx`.

Look at the second question. “The day after” only makes sense because of the
history, and the agent shouldn't need to geocode again: the coordinates are
already in its memory. Open `run.log` and check what it actually did.

:::quiz{id="checkpoint-trace" xp=20}
On the follow-up question, run.log shows one turn calling get_forecast and no geocode. Why?

- [ ] geocode is cached inside tools.ts
  Not quite. tools.ts has no cache. Every call goes to Open-Meteo.
- [x] The earlier geocode result is still in history, so Claude reused the coordinates
  Right. Memory is the messages array, tool results included. The model read them and skipped a call.
- [ ] Claude remembers Chicago's coordinates from training
  It may know them roughly, but the system prompt says to use the tools, and the exact numbers came from the earlier result.
:::

---

Here's the honest bit. Now that you can write the loop, you often don't need
to. The Anthropic SDK has a **tool runner** (in beta as of October 2026) that
runs this exact loop for you. It calls the model, runs your tool functions,
sends back the results, and stops when Claude stops asking. A tool that
throws becomes an `is_error` result, just like your `runTool`, and Zod checks
each input before your function sees it.

:::code{file="runner.ts" lang="ts" copy highlight="23-29" label="the loop, done for you"}
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fetchForecast } from "./weather"; // your Open-Meteo call

const client = new Anthropic();

const getForecast = betaZodTool({
  name: "get_forecast",
  description:
    "Daily forecast for a latitude and longitude. For each day: the high " +
    "and low, the top chance of rain (%) and the top wind speed (mph). " +
    "Day 1 is today; 7 days at most. No hourly detail, no past weather.",
  inputSchema: z.object({
    latitude: z.number(),
    longitude: z.number(),
    days: z.number().int().min(1).max(7),
  }),
  run: async ({ latitude, longitude, days }) =>
    JSON.stringify(await fetchForecast(latitude, longitude, days)),
});

const runner = client.beta.messages.toolRunner({
  model: "claude-sonnet-5-5",
  max_tokens: 16000,
  max_iterations: 8,
  tools: [getForecast],
  messages: [{ role: "user", content: "Bike or train at 41.85, -87.65 tomorrow?" }],
});

for await (const message of runner) {
  console.error(JSON.stringify({ stop: message.stop_reason, usage: message.usage.output_tokens }));
}
const final = await runner.done(); // the last message
console.log(final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""));
:::

`max_iterations` is your turn limit, and the runner hands you each message
as it goes, so you can still log every turn. It needs `zod` installed. You
still own the parts that decide whether an agent works: clear descriptions,
actionable errors, a budget and logs. That was the real subject of this
course.

---

Last step. Play the model's final turn by hand. Paste a forecast as if a tool
had just returned it, ask your question, and tell Claude to use only that
data. This is the observe step, seen from the model's side.

:::prompt{id="final-turn" xp=50}
Give Claude a tool result and ask for the agent's final answer

- placeholder "Tool result from get_forecast: [...]. Using only this data, should I bike to work tomorrow at 8? Answer in … sentences. If something's missing, say so."
- draft "Should I bike to work tomorrow?"
- check "Includes the forecast data"     /rain|wind|\bhigh\b|°|forecast|\[/i
- check "Asks a real question"           /\?/
- check "Sets a length limit"            /\bwords?\b|\bsentences?\b|\bunder\b|\bshort\b|\bbrief\b|\bmax/i
- check "Keeps it to the data"           /\bonly\b|don.t guess|not sure|missing|say so|unknown|don.t know/i
- run temperature=[1.0]
- example T=1.0 "Yes, bike. Tomorrow looks dry (2% chance of rain) with wind up to 11 mph. The low is 50°F, so wear a layer. The data doesn't say exactly what it'll be like at 8."
- example T=1.0 "Biking looks fine: the chance of rain is only 2% and the wind tops out around 11 mph. I can't see hourly temperatures, so plan for the 50°F low in the morning."
- example T=1.0 "Go for the bike. Dry (2% rain), light wind, high 76°F, low 50°F. The forecast is daily, so I can't promise conditions at 8 exactly."
- success "That's the observe step: real data in, grounded answer out." next="Finish the course →"
:::

Finish this checkpoint and the **Loop Closer** badge is yours. You can
explain plan → act → observe, write the loop, handle every stop reason, run
many tools at once, stop a loop that won't end, give an agent memory, and put
limits and logs on it before it ships.

:::rabbithole
- read "Tool runner" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner"
- read "Effective harnesses for long-running agents" by="Anthropic" url="https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents"
- read "Open-Meteo API docs" by="Open-Meteo" url="https://open-meteo.com/en/docs"
:::
