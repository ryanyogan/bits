---
# sources (checked 2026-10-27):
# - Anthropic, Building effective agents (2024-12-19): workflows vs agents, "start with the
#   simplest solution", agents are "LLMs using tools based on environmental feedback in a
#   loop", ground truth from the environment at each step, stopping conditions
#   https://www.anthropic.com/engineering/building-effective-agents
# - Matt Pocock, AI Hero, What is an agent? (workflows: code decides the steps; agents: the
#   LLM picks the next tool)
#   https://www.aihero.dev/what-is-an-agent
# - bits app/runs/model.ts (the sandbox sends one user message and no tools)
# Toy: the compare rows are illustrative.
title: "Agents are loops"
order: 1
minutes: 6
xp: 40
module: What an agent is
---

You already know how to hand Claude one tool and use its answer. An **agent**
is what you get when you stop deciding the next step yourself and let the
model decide, over and over, until the job is done.

Anthropic draws the line like this. In a **workflow**, your code decides the
steps: call the model, then this tool, then the model again, always in that
order. In an **agent**, the model decides which tool to call next, looks at
what came back, and decides again. Your code just keeps the loop running.

---

Every agent runs the same three beats. **Plan**: the model reads the task
and everything so far, and picks an action. **Act**: your code runs the tool
it asked for. **Observe**: the result goes back into the conversation, and the
model plans again with that new fact in hand.

The observe step is the whole point. A tool result is **ground truth** from
the outside world: the real forecast, the real file, the real error. Without
it, the model is guessing. With it, it can notice that it was wrong and
change course.

Here's the same question handled both ways.

:::compare{left="Workflow (code picks the steps)" right="Agent (model picks the steps)" illustrative}
- prompt "Should I bike to work in Chicago tomorrow?"
- left "Step 1: get_forecast(city). Step 2: ask the model to summarise. Always two calls, even when the question needs something else."
- right "Plan: I need Chicago's coordinates. Act: geocode. Observe: 41.85, −87.65. Plan: now tomorrow's forecast. Act: get_forecast. Observe: 70% rain. Answer: take the train."
- prompt "Is it warmer in Lyon or Leeds this weekend?"
- left "The same two fixed steps can only look up one city, so the answer comes back half done."
- right "It geocodes both cities, fetches both forecasts in one turn, compares, then answers."
:::

---

So should everything be an agent? No. Anthropic's advice is to find the
**simplest thing that works** and add steps only when you need them. A single
well-written prompt beats a workflow for most jobs, and a workflow beats an
agent whenever you can write the steps down in advance. Agents cost more,
take longer, and their mistakes can compound over many steps.

Reach for an agent when you **can't predict the steps**: the number of tool
calls depends on what the first ones return.

:::quiz{id="needs-an-agent" xp=10}
Which of these jobs most needs an agent?

- [ ] Translate every product description into French
  Not quite. The steps never change: one call per description. That's a loop in your code, not a decision for the model.
- [x] Find why last night's build failed and suggest a fix
  Right. Which logs to read and what to check next depends on what each step turns up, so the model has to choose.
- [ ] Sort support emails into five fixed categories
  Not quite. One classification call per email does it. Anthropic calls this kind of fixed path a workflow.
:::

---

Your turn to be the planner. The sandbox runs Claude without tools, so it
can't act yet, but it can plan. Give it a question and a short list of tools
in plain words, and ask for the calls it would make, in order.

:::prompt{id="plan-the-calls" xp=30}
Ask Claude to plan the tool calls for a weather question

- placeholder "Tools: geocode(city) → lat/lon; get_forecast(lat, lon, days). Question: … List the calls you'd make, in order."
- draft "Should I bike to work in Chicago tomorrow?"
- check "Lists some tools"           /geocode|forecast|tool/i
- check "Asks for steps in order"    /\bsteps?\b|\border\b|\bplan\b|\bfirst\b|\bsequence\b|\blist\b/i
- check "Includes a real question"   /\?/
- run temperature=[1.0]
- example T=1.0 "1. geocode(\"Chicago\") to get its latitude and longitude. 2. get_forecast(lat, lon, days=2), since day 1 is today and I need tomorrow. 3. Check tomorrow's rain chance and wind. If rain is likely or it's very windy, suggest the train; otherwise, bike."
- example T=1.0 "First I'd call geocode with \"Chicago\". With those coordinates I'd call get_forecast for 2 days and read tomorrow's entry. Then I'd answer based on the rain and wind. I can't know the forecast until those calls return."
- example T=1.0 "Plan: geocode(\"Chicago\") → coordinates. get_forecast(coordinates, days=2) → tomorrow's high, low, rain and wind. Decide: dry and calm means bike."
- success "That's the plan step. Next you'll give the model real tools to act with." next="Next: tools, seen from the loop →"
:::

Notice that a good plan says what it **can't know yet**. That gap is what the
act and observe steps fill.

:::rabbithole
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
- read "What is an agent?" by="Matt Pocock, AI Hero" url="https://www.aihero.dev/what-is-an-agent"
:::
