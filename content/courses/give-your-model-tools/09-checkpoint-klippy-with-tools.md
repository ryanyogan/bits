---
# sources (checked 2026-11-03):
# - Cloudflare D1, Migrations (apply --remote) https://developers.cloudflare.com/d1/reference/migrations/
# - Cloudflare Workers, Secrets https://developers.cloudflare.com/workers/configuration/secrets/
# - AI SDK, stopWhen / isStepCount https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
# - Klippy b-08 → b-09, recorded output docs/outputs/b-09.txt (2026-11-03). The remote migration and the
#   local tour are recorded; the live deploy is not (only `wrangler deploy --dry-run`), and the lesson
#   says so. The Workers AI fallback answered, not Claude.
title: "Checkpoint: Klippy with tools"
order: 9
minutes: 25
xp: 120
module: Ship it
device: desk
tag: b-08
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
  agents: "0.33.0"
  ai: "7.0.162"
  zod: "4.6.7"
  remix: "3.1.0"
---

Klippy has five tools now: the weather, the time, saving and listing notes,
and reading a link. Time to join them up, fix the one bug a full tour
finds, ship it, and let bits check it. Then a last exercise on the idea
under all of it: descriptions.

### 1. The bug a tour finds

Ask "Should I take an umbrella in Dublin today?" and the model may call
`getTime` first (what's "today" there?), then `getWeather` in a **second**
step. With `isStepCount(2)`, Klippy stops right there, after two tool
steps and before any answer, and the reply is `"answer":""`. We hit exactly
this while recording. Fix it in `apps/agent/src/ask.ts`:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-09" highlight="1-2" label="apps/agent/src/ask.ts"}
		// Up to two rounds of tools (say the time, then the weather), then the answer. Then stop, whatever happens.
		stopWhen: isStepCount(3),
:::

Three steps: up to two rounds of tools, then the answer. Still a hard
stop. And if a question needs more than that, say so instead of sending an
empty string:

:::code{file="apps/agent/src/ask.ts" lang="ts" tag="b-09" highlight="2-4" label="apps/agent/src/ask.ts"}
	// Which model answered: Claude, or the fallback.
	// Stopped mid-way (the last step was still a tool call)? Then there's no text: say so instead of sending "".
	const answer = text || "Sorry, I ran out of steps before I could answer. Try asking one thing at a time.";
	return { answer, model: providerMetadata?.cloudflare?.model };
:::

`text` is empty when the last step was still a tool call. An honest "I ran
out of steps" beats a blank reply. Course C is about loops and how many
steps to allow; for now, three and a clear message.

### 2. Tell bits where you are

`TAG` in `apps/agent/src/check.ts` says which lesson your code is at. Move
it to this checkpoint:

:::code{file="apps/agent/src/check.ts" lang="ts" tag="b-09" highlight="2-2" label="apps/agent/src/check.ts"}
// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'b-09';
:::

### 3. Run every test

`test/check.spec.ts` checks the tag too, so copy `apps/agent/test/` from tag
`b-09` first (or change `'a-05'` to `'b-09'` in that file). Then:

```sh
pnpm typecheck
pnpm test
```

:::terminal{cmd="pnpm test"}
apps/agent test$ vitest run
apps/agent test:  Test Files  [volt]9 passed[text] (9)
apps/agent test:       Tests  [volt]35 passed[text] (35)
apps/agent test: Done
:::

Plus the driver's 24 tests in `packages/data-table-d1`. If any fail,
compare the file with tag `b-09` before you deploy.

### 4. The live database

Your live Worker gets its own D1 database, separate from the local copy.
It's empty, so apply the migration there too. In `apps/agent`:

```sh
pnpm wrangler d1 migrations apply klippy-db --remote
```

:::terminal{cmd="pnpm wrangler d1 migrations apply klippy-db --remote"}
Migrations to be applied:
│ name           │
│ 0001_notes.sql │
? About to apply 1 migration(s)
Your database may not be available to serve requests during the migration, continue?
[muted]🤖 Using fallback value in non-interactive context: yes
🌀 Executing on remote database klippy-db (e51fc5ce-ea1d-48b0-afd7-e0af5cd1672f):
[volt]🚣 Executed 2 commands in 0.97ms
│ name           │ status │
│ 0001_notes.sql │ ✅     │
:::

Type `y` when it asks. Always migrate **before** you deploy code that
needs the table, so the first request after the deploy finds it there.

### 5. The tour

Before shipping, try every tool locally. Our tour (with the free fallback
model, as all through this course):

:::terminal{cmd="curl -s -X POST http://localhost:8801/ask -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;question&quot;:&quot;Should I take an umbrella in Dublin today?&quot;}'"}
{"answer":"The weather in Dublin is currently clear with no precipitation, so you don't need an umbrella today.","model":"@cf/zai-org/glm-4.7-flash"}
:::

:::terminal{cmd="curl -s -X POST http://localhost:8801/note -H &quot;Authorization: Bearer demo-token-for-the-recording&quot; -d '{&quot;text&quot;:&quot;pick up the parcel from the post office before sat noon, ref 4471&quot;}'"}
{"saved":{"id":8,"body":"Pick up the parcel from the post office before Saturday noon, ref 4471"}}
:::

:::terminal{cmd="curl -s 'http://localhost:8801/klippy/check?nonce=checkpoint-b09'"}
{"nonce":"checkpoint-b09",[volt]"tag":"b-09"[text],"probe":{"answer":"Hello, bits!","model":"@cf/zai-org/glm-4.7-flash"}}
:::

We also asked the time in Sydney (`getTime`), what we'd noted lately
(`listNotes`) and about `https://example.com`. On that last one the
fallback model answered from memory without calling `readLink`, though it
called it in the last lesson. Free models are less reliable at tool use
than Claude; that's the trade.

### 6. Ship it

In `apps/agent` (your token is already set if you deployed in Your first
Worker; if not, `pnpm wrangler secret put KLIPPY_TOKEN` first):

```sh
pnpm wrangler deploy
```

**What we recorded, and what we didn't.** As in Your first Worker, we
haven't deployed the reference Klippy, so there's no recorded live deploy.
Our dry run shows what goes up: the new `DB` binding is there.

:::terminal{cmd="pnpm wrangler deploy --dry-run"}
Total Upload: 1535.58 KiB / gzip: 273.53 KiB
Your Worker has access to the following bindings:
Binding                            Resource
env.DB (klippy-db)                 D1 Database
env.AI                             AI
env.LIMITER (10 requests/60s)      Rate Limit
--dry-run: exiting now.
:::

### 7. Let bits check it

Paste your Worker's address. bits calls `/klippy/check` on it and looks for
this checkpoint's tag.

:::verify{id="klippy-with-tools" path="/klippy/check?nonce=bits-checkpoint-b09" xp=60}
Paste the https://….workers.dev address that `wrangler deploy` printed.
- goal "Your Klippy is live at this checkpoint: /klippy/check answers with bits' nonce and tag b-09 (or a later one)"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-b09"/
- expect "Is at b-09 or later" match /"tag"\s?:\s?"(b-09|[c-g]-\d\d)"/
- hint "Open /klippy/check?nonce=hello-from-me on your address in a browser. Does it say \"tag\":\"b-09\"?"
- hint for="Is at b-09 or later" "Set TAG = 'b-09' in src/check.ts, then deploy again: the live Worker still runs your old code."
- hint for="Answers the check" "A 429 means the check was called too often: wait a minute. A 500 can mean the probe failed: run wrangler tail and check again."
:::

A pass proves a Worker at that address answers the way this lesson asks.
It doesn't prove who wrote it. Then, on your live Klippy, try a note with
your token: it lands in the live database you migrated.

### 8. Last exercise: descriptions, one more time

Everything in this course rests on the descriptions Claude reads. Test
that one last time in the sandbox: write a `get_weather` description, then
have Claude decide **tool or no tool** for three messages. Only the first
should need it.

:::prompt{id="test-the-description" xp=60 coach}
Write the bot's tool description, then test it on three messages
- goal "Write a get_weather description, then have Claude decide tool or no tool for three messages. Only the first needs the tool"
- placeholder "Tool get_weather: … Use it when … It can't … For each message below, reply tool or no tool: …"
- draft "Messages: 1) Weather in Lima right now? 2) What's the capital of Peru? 3) Will it rain in Cusco tomorrow? For each, reply tool or no tool."
- check "Names the tool" /get_weather/i
- check "Says what it does" /temperature|conditions|sky|the weather for/i
- check "Says what it can't do" /no forecast|not (for )?forecast|can.t|cannot|doesn.t|does not|only current/i
- check "Keeps the three messages" /lima/i
- check "Keeps the three messages" /peru/i
- check "Keeps the three messages" /cusco/i
- expect "Decides tool or no tool" match /no tool/i
- rubric "Message 1, weather in Lima right now: uses the tool" must evidence
- rubric "Message 2, the capital of Peru: no tool, Claude already knows it" must evidence
- rubric "Message 3, rain in Cusco tomorrow: no tool, because get_weather can't forecast" must evidence
- rubric "Says what it would tell the user when the tool can't help" should
- hint "Claude decides from your description alone. Does it say what get_weather can't do?"
- hint "Look at message 3. If the description doesn't mention forecasts, why wouldn't Claude reach for the tool?"
- hint "Three lines: what get_weather returns, when to use it, and that it has no forecasts. Then the three messages, and ask for tool or no tool with a reason."
- reference "Tool get_weather: returns the current temperature and sky conditions for one city. Use it when the user asks about the weather right now. It can't forecast: it has no data about later hours or days.\n\nFor each message, reply tool or no tool, with a short reason:\n1) Weather in Lima right now?\n2) What's the capital of Peru?\n3) Will it rain in Cusco tomorrow?"
- run temperature=[1.0]
- example T=1.0 "1) tool: get_weather {\"city\": \"Lima, Peru\"} 2) no tool, I know that one: Lima. 3) no tool: it only has current conditions, not forecasts."
- example T=1.0 "1) tool 2) no tool 3) no tool, since get_weather can't forecast tomorrow."
- example T=1.0 "1) tool, city Lima. 2) no tool. 3) no tool: the description rules out forecasts, so I'd tell the user I can't check tomorrow's weather."
- success "Two out of three need no tool, and Claude knew it from your words alone." next="Finish the course →"
:::

:::quiz{id="checkpoint-ideas" xp=20}
Which of these is your code's job, not the model's?

- [ ] Deciding whether a question needs getWeather
  Not quite. Claude decides that, from your description. That's why descriptions matter so much.
- [x] Checking a note's length, refusing unknown time zones and fetching only typed links
  Right. The model decides; your code does, and your code guards. Those checks hold whatever the model believes.
- [ ] Writing the answer from the tool's result
  Not quite. That's the model's step after the tool runs.
:::

That's Klippy with tools: five of them, guarded, tested, deployed and
checked. Your code matches tag `b-09`
([changes from b-08](https://github.com/ryanyogan/klippy/compare/b-08...b-09)).
In the next course, Klippy becomes an agent: a loop, a memory, and one
Klippy per person.

:::rabbithole
- read "D1 migrations" by="Cloudflare" url="https://developers.cloudflare.com/d1/reference/migrations/"
- read "Tool calling: multi-step calls" by="AI SDK" url="https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling"
:::
