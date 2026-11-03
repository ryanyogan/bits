---
# sources (checked 2026-10-27):
# - Cloudflare, Workers Logs (observability.enabled; head_sampling_rate 0–1, default 1;
#   log JSON objects so fields are indexed and filterable; console.log output is captured;
#   retention 3 days Free / 7 days Paid; 256 KB per log; Workers Issues groups errors)
#   https://developers.cloudflare.com/workers/observability/logs/workers-logs/
# - Cloudflare, Traces (observability.traces.enabled; the top-level setting alone doesn't
#   turn on traces)
#   https://developers.cloudflare.com/workers/observability/traces/
# - Cloudflare, Wrangler commands (`wrangler tail` starts a live log session)
#   https://developers.cloudflare.com/workers/wrangler/commands/workers/
# - Anthropic, Messages API (usage.input_tokens / output_tokens, stop_reason)
# - bits itself: decision 039 (JSON log lines; never log full URLs or email addresses)
# The terminal output is an example.
title: "Logs you can query"
order: 6
minutes: 8
xp: 60
module: Running it safely
---

When a user says “the agent gave me nonsense at lunchtime”, you need to find
**that** run among thousands. That only works if you logged it in a shape
you can search.

Turn on **Workers Logs** and traces in the config. Everything your Worker
writes with `console.log` is then kept and searchable in the dashboard:

:::code{file="wrangler.jsonc" lang="json"}
{
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "traces": { "enabled": true }
  }
}
:::

`head_sampling_rate` is the share of requests to keep, from 0 to 1. Keep
all of them while traffic is small and lower it later. Traces need their
own `enabled` flag; the top-level one alone only turns on logs.

---

Now the important part: **log objects, not sentences**. Workers Logs
indexes the fields of a JSON object, so you can filter on any of them.

:::compare{left="A sentence" right="An object"}
- left "turn 2 for user 8f3a done (end_turn), 1834 in / 212 out"
- right "{ event: \"turn\", user: \"8f3a\", turn: 2, stop_reason: \"end_turn\", input_tokens: 1834, output_tokens: 212, ms: 2310 }"
:::

To find every run where `stop_reason` was `max_tokens`, the sentence needs a
text search and luck. The object needs one filter. Log one line per model
call, inside the loop:

:::code{file="src/agent.ts" lang="ts" highlight="3-12" label="one line per turn"}
const started = Date.now();
const res = await client.messages.create({ model, max_tokens: 4096, tools, messages });
console.log(JSON.stringify({
  event: "turn",
  user: userId,
  turn,
  model: res.model,
  stop_reason: res.stop_reason,
  input_tokens: res.usage.input_tokens,
  output_tokens: res.usage.output_tokens,
  ms: Date.now() - started,
}));
:::

What's **not** in it matters as much. No prompt text, no tool results, no
email addresses, no keys. Logs are copied around, kept for days and read by
people who don't need your users' words. Log an opaque user id, the shape of
the run and the numbers. If you need the actual prompts for debugging, AI
Gateway already keeps them, under its own retention settings.

For failures, use `console.error`. Workers groups errors and exceptions into
**Workers Issues**, so a new kind of failure shows up once, with a count,
instead of as a thousand loose lines.

While you're developing, stream the deployed Worker's logs live. `--search` keeps only lines that contain the text:

:::terminal{cmd='npx wrangler tail --search "turn"'}
[muted]# example output, trimmed to your log lines
[ion]{"event":"turn","user":"8f3a","turn":1,"stop_reason":"tool_use",[quiet]"input_tokens":1610,"output_tokens":64,"ms":1290}
[ion]{"event":"turn","user":"8f3a","turn":2,"stop_reason":"end_turn",[quiet]"input_tokens":1834,"output_tokens":212,"ms":2310}
:::

:::quiz{id="which-log" xp=20}
Which log line lets you filter the dashboard for runs that hit `max_tokens`?

- [ ] `console.log("stopped: " + res.stop_reason)`
  Not quite. That's one string. You'd need a text search across every message.
- [x] `console.log(JSON.stringify({ event: "turn", stop_reason: res.stop_reason }))`
  Right. Workers Logs pulls out `stop_reason` as its own field, so it's one filter.
- [ ] `console.log(res)`
  Not quite. It dumps the whole response, including the user's content, and can hit the 256 KB log size limit.
:::

:::quiz{id="what-not-to-log" xp=20}
Which of these belongs in your per-turn log line?

- [ ] The user's full prompt, so you can replay it
  Not quite. Prompts can contain anything people type. Keep them out of general logs.
- [ ] The request URL, with its query string
  Not quite. Query strings often carry tokens and email addresses.
- [x] Token counts, stop reason and duration
  Right. Numbers and shapes tell you what went wrong without exposing what people wrote.
:::

Your turn. Here's a log line from an old version of the agent, a sentence
with the user's question pasted in:

```text
turn 2 for user 8f3a done (end_turn), 1834 in / 212 out, 2310 ms, prompt: "is it raining at 14 Elm Street right now?"
```

Ask Claude to turn it into one JSON object you can filter in Workers Logs,
with the user's words left out.

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

:::rabbithole
- read "Workers Logs" by="Cloudflare" url="https://developers.cloudflare.com/workers/observability/logs/workers-logs/"
- read "Traces" by="Cloudflare" url="https://developers.cloudflare.com/workers/observability/traces/"
:::
