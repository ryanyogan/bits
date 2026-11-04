---
# sources (checked 2026-11-03):
# - Cloudflare Durable Objects, Migrations (new_sqlite_classes, applied on deploy)
#   https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
# - Klippy c-08 → c-09, recorded output docs/outputs/c-09.txt (2026-11-03). The local tour, the check and the dry run
#   are recorded; the live deploy is not, and the lesson says so. The Workers AI fallback answered, not Claude.
title: "Checkpoint: Klippy, the agent"
order: 9
minutes: 20
xp: 120
module: Ship it
device: desk
tag: c-08
verified: 2026-11-03
versions:
  wrangler: "4.157.0"
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
---

Klippy is an agent now. One per person, a chat in your terminal, facts that
outlive the chat, a `y/n` before it writes, limits on runaway loops and
pages, and reminders that speak on their own. Time to tour it, ship it, and
let bits check it.

### 1. Name the tag

The only code change: bits reads the tag from `/klippy/check`. In
`apps/agent/src/check.ts` (and its test, `test/check.spec.ts`):

:::code{file="apps/agent/src/check.ts" lang="ts" tag="c-09" highlight="2" label="apps/agent/src/check.ts"}
// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'c-09';
:::

Run `pnpm test`: all 64 tests should pass. If the rate-limit test fails once, run it again: it counts in 60-second windows, and a run that crosses a window boundary can miss its 429 (fixed on Klippy's `main`).

### 2. The tour

Every lesson in one chat, locally. Ours (the Workers AI fallback answered,
not Claude; input piped, so the `y` doesn't echo):

:::terminal{cmd="(printf &quot;Hi, I am Ryan and I live in Dublin. Please remember that.\n/clear\nWhat should I wear today?\nSave a note: renew my passport.\ny\nRemind me in one minute to stretch.\n&quot;; sleep 100) | KLIPPY_URL=http://localhost:8801 pnpm chat ryan-c09"}
Talking to Klippy "ryan-c09" (8 messages so far). /clear to start over, Ctrl+D to quit.
you> [synapse]klippy>[text] Got it, Ryan! I've remembered that you live in Dublin.
you> [muted](chat cleared)
you> [synapse]klippy>[text] What type of clothing works for you (e.g., shirt, pants), and where will you be going? Then I can look up the Dublin weather and suggest appropriate garments.
you> [synapse]klippy>[text]
[ion]Klippy wants to use saveNote with {"body":"renew my passport"}. Allow? (y/n)[text] [synapse]klippy>[text] Got it. I’ve saved your note: "renew my passport" (ID 16).
you> [synapse]klippy>[text] QiDone! I’ll message you in one minute to stretch.
you>
[synapse]klippy>[text] Go stretch!
:::

Read it honestly:

- **Memory worked**: after `/clear`, it still knew Dublin.
- **But it asked instead of acting.** With Dublin known, a good answer
  calls `getWeather`. The free model asked a question; we expect Claude to
  do better, and will re-record once we have a key.
- **"QiDone!"** is the fallback model's stray output, kept as recorded.
- The last line came by itself, a minute later.

### 3. Ship it

In `apps/agent`:

```sh
pnpm wrangler deploy
```

The first deploy with the `Klippy` Durable Object applies its migration
(`v1`, `new_sqlite_classes`) for you. Your `KLIPPY_TOKEN` secret and the
remote D1 table are already there from earlier courses. Then talk to the
live one:

```sh
KLIPPY_URL=https://klippy.<your-subdomain>.workers.dev pnpm chat me
```

**What we recorded, and what we didn't.** We haven't deployed the reference
Klippy, so there's no recorded live deploy. Our dry run shows what goes
up, with the Durable Object binding new since course B:

:::terminal{cmd="pnpm wrangler deploy --dry-run"}
Total Upload: 3679.00 KiB / gzip: 711.85 KiB
Your Worker has access to the following bindings:
Binding                            Resource
[volt]env.Klippy (Klippy)                Durable Object[text]
env.DB (klippy-db)                 D1 Database
env.AI                             AI
env.LIMITER (10 requests/60s)      Rate Limit
--dry-run: exiting now.
:::

And the check, locally:

:::terminal{cmd="curl -s 'http://localhost:8801/klippy/check?nonce=checkpoint-c09'"}
{"nonce":"checkpoint-c09",[volt]"tag":"c-09"[text],"probe":{"answer":"Hello, bits!","model":"@cf/zai-org/glm-4.7-flash"}}
:::

### 4. Let bits check it

Paste your Worker's address. bits calls `/klippy/check` on it and looks for
this checkpoint's tag.

:::verify{id="klippy-the-agent" path="/klippy/check?nonce=bits-checkpoint-c09" xp=60}
Paste the https://….workers.dev address that `wrangler deploy` printed.
- goal "Your Klippy is live at this checkpoint: /klippy/check answers with bits' nonce and tag c-09 (or a later one)"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-c09"/
- expect "Is at c-09 or later" match /"tag"\s?:\s?"(c-09|[d-g]-\d\d)"/
- hint "Open /klippy/check?nonce=hello-from-me on your address in a browser. Does it say \"tag\":\"c-09\"?"
- hint for="Is at c-09 or later" "Set TAG = 'c-09' in src/check.ts, then deploy again: the live Worker still runs your old code."
- hint for="Answers the check" "A 429 means the check was called too often: wait a minute. A 500 can mean the probe failed: run wrangler tail and check again."
:::

A pass proves a Worker at that address answers the way this lesson asks.
It doesn't prove who wrote it.

:::quiz{id="agent-locks" xp=20}
A reminder fires. Which tools can Klippy use in that turn?

- [ ] All of them: it's Klippy's own turn
  Not quite. The reminder's text was written by the model, so the turn is locked down.
- [ ] Only remindMe, to snooze it
  Not quite. Then a reminder could schedule another one, forever.
- [x] None: it can only speak
  Right. A nudge turn builds no tools and is offered none.
:::

That's Klippy, the agent. Your code matches tag `c-09`
([changes from c-08](https://github.com/ryanyogan/klippy/compare/c-08...c-09)).
In the next course, you'll give it a face: a web front end, built by
directing Claude Code.

:::rabbithole
- read "Durable Objects migrations" by="Cloudflare" url="https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/"
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
:::
