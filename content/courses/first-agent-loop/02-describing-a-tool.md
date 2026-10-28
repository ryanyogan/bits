---
# sources (checked 2026-10-27):
# - Anthropic docs, Define tools ("provide extremely detailed descriptions … by far the most
#   important factor"; what it does, when to use it, each parameter, caveats; 3–4 sentences
#   at least; return only high-signal fields; consolidate and namespace tools)
#   https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
# - Anthropic docs, Structured outputs → JSON Schema limitations (strict tools: enum supported;
#   minimum/maximum not supported; additionalProperties must be false)
#   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# - Anthropic, Building effective agents, Appendix 2 (agent-computer interface; poka-yoke your
#   tools; absolute file paths example)
#   https://www.anthropic.com/engineering/building-effective-agents
# - Anthropic, Writing effective tools for agents (2025-09-11)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
# Toy: the compare rows are illustrative.
title: "Describing a tool"
order: 2
minutes: 7
xp: 40
module: What an agent is
---

In an agent, the model picks the tools. It can only pick well from what you
tell it, and all it ever sees of a tool is its **definition**: a name, a
description and an input schema. The model never sees your code.

So a tool definition is a prompt. Anthropic's docs put it bluntly: a detailed
description is **by far the most important factor** in how well Claude uses a
tool. Say what the tool does, when to use it and when not to, what each input
means, and what it doesn't cover. Three or four sentences at least.

:::compare{left="Thin description" right="Useful description" illustrative}
- prompt "get_forecast"
- left "Gets the weather."
- right "Daily forecast for a latitude and longitude from geocode. For each day: the high and low, the top chance of rain (%) and the top wind speed (mph). Day 1 is today; 7 days at most. No hourly detail, no past weather."
- prompt "What the model does with it"
- left "Calls it with a city name it made up a format for, asks for 14 days, and guesses at what the numbers mean."
- right "Calls geocode first, asks for 2 days to cover tomorrow, and knows to say so when someone asks about last week."
:::

---

Here's that tool as code. The **description** carries the meaning. The
**schema** carries the shape.

:::code{file="forecast-tool.ts" lang="ts" copy highlight="5-9" label="the prompt part"}
import type Anthropic from "@anthropic-ai/sdk";

export const getForecast: Anthropic.Tool = {
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
};
:::

Two schema habits pay off. Use an `enum` when only a few values make sense,
so `units` can't come back as "F" or "freedom units". And set `strict: true`
with `additionalProperties: false`: the API then guarantees the input matches
your schema exactly. Strict schemas can't express `minimum` or `maximum` (as
of October 2026), so put ranges like "1 to 7" in the description and still
check them in your code.

---

Anthropic calls this designing the **agent-computer interface**, and suggests
you **poka-yoke** your tools: shape them so mistakes are hard to make. Their
own coding agent kept fumbling relative file paths, so they made the tool
require absolute paths, and the mistakes stopped. Here that means taking
coordinates rather than a free-text place, and returning only the fields the
model needs.

:::quiz{id="better-tool" xp=10}
Your agent keeps calling get_forecast with `days: 14`, but the tool only covers 7. What's the best first fix?

- [ ] Add “never ask for more than 7 days” to the system prompt
  It might help, but the rule belongs with the tool. Every prompt that uses this tool would need to repeat it.
- [x] Say “7 days at most” in the tool's description, and return a clear error if it's exceeded
  Right. The description is where the model looks when it fills in the input, and a clear error lets it fix the call itself.
- [ ] Rename the tool to get_forecast_7_days
  A name can hint, but it can't explain. Descriptions are where the detail goes.
:::

---

Your turn. Write a description for a tool of your own, or rewrite
get_forecast's, then ask Claude what's unclear about it. A model reading a
tool cold is the best reviewer you've got.

:::prompt{id="review-a-tool" xp=30}
Write a tool description and ask Claude to find what's unclear

- placeholder "Tool: get_forecast. Description: … What would you need to know to call this correctly?"
- draft "Tool: get_forecast. Description: Gets the weather."
- check "Says what it returns"        /\breturns?\b|\bgives\b|\bhigh\b|\brain\b|\bfor each\b/i
- check "Says how to call it"         /\bwhen\b|\bbefore\b|\bafter\b|\binputs?\b|\bparameters?\b|\btakes\b/i
- check "States a limit or unit"      /\bunits?\b|fahrenheit|celsius|\bmph\b|at most|\blimit\b|\bdays\b|\bno \w/i
- check "Asks for a review"           /unclear|ambiguous|missing|improve|confus|questions?\b|review/i
- run temperature=[1.0]
- example T=1.0 "Mostly clear. Two questions: are latitude and longitude decimal degrees? And which time zone does day 1 use? Also say whether temperatures follow the units input or are always one unit."
- example T=1.0 "I'd still need to know: what format the coordinates take, what happens if I ask for 0 days, and whether \"top chance of rain\" is for the whole day or a part of it."
- example T=1.0 "It's unclear what this returns. Temperature? Rain? Which units? I also don't know what input it takes: a city name, a ZIP code, coordinates? And how far ahead can it look?"
- success "Every question Claude asked is one your agent would have guessed at." next="Next: running a tool →"
:::

:::rabbithole
- read "Define tools" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
- read "Writing effective tools for agents" by="Anthropic" url="https://www.anthropic.com/engineering/writing-tools-for-agents"
:::
