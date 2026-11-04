---
# sources (checked 2026-11-03):
# - Cloudflare D1, Migrations (migrations apply --remote)
#   https://developers.cloudflare.com/d1/reference/migrations/
# - Cloudflare Workers, Wrangler configuration, `secrets.required` (deploy fails while one is missing)
#   https://developers.cloudflare.com/workers/wrangler/configuration/
# - Klippy f-07 → f-08, recorded output docs/outputs/f-08.txt (2026-11-03): typecheck, tests (agent 111),
#   both dry runs, and a local tour on 8802 (curl, and the chat island in headless Chromium with a local
#   test cookie for GitHub id 1). Every reply is the Workers AI fallback (glm-4.7-flash), not Claude.
#   NOT recorded: a live deploy of either Worker, the remote migrations, CI secrets, spend limits, the saved
#   queries or a custom domain. The lesson says the learner deploys it.
title: "Checkpoint: Klippy in production"
order: 8
minutes: 30
xp: 120
module: Ship it
project: true
device: desk
tag: f-07
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
  wrangler: "4.157.0"
  remix: "3.1.0"
---

Klippy is ready for the internet. The agent has no public address, every
model call is labelled and the check probe is cached by key, a per-user
limit and a daily budget hold (every call is charged before it's made),
each turn logs its shape, a test
proves a fooled model can't write or send data out, and CI can deploy
`main` and preview pull requests. Name the tag, take the tour, and then
**deploy it yourself**: bits checks your live web app.

### 1. Name the tag

In `apps/agent/src/check.ts` (and `test/check.spec.ts`):

:::code{file="apps/agent/src/check.ts" lang="ts" tag="f-08" highlight="2" label="apps/agent/src/check.ts"}
// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'f-08';
:::

Run `pnpm typecheck && pnpm test`: ours was 25 agent test files, 111 tests
passed.

### 2. The tour

Locally, with `pnpm dev:web` (the Workers AI fallback answered, not
Claude). The check, through the web app:

:::terminal{cmd="curl -s 'localhost:8802/klippy/check?nonce=checkpoint-f08'"}
{"nonce":"checkpoint-f08",[volt]"tag":"f-08"[text],"probe":{"answer":"Hi bits, it's Klippy here to help!","model":"@cf/zai-org/glm-4.7-flash","cache":"MISS"}}
:::

Signed out, `/` sends you to `/login`. Signed in (a test cookie for GitHub
id 1), a file goes in through the web app and search finds it:

:::terminal{cmd="curl -s -b <cookie> 'localhost:8802/sources/search?q=Lisbon+flight'"}
{"hits":[{"chunkId":2,"sourceId":2,[volt]"title":"trip-f08.md"[text],"url":null,"kind":"file","context":"","text":"# Trip\n\nMy Lisbon flight leaves on Friday at 18:40 from Terminal 2."}, …]}
:::

Then the chat, in a browser. "What time does my Lisbon flight leave? Check
my notes." got this (the tool card, then the reply):

:::terminal{cmd="the chat, as the page read it"}
[synapse]Klippy:[text] searchNotes Done Your Lisbon flight leaves at 18:40 (6:40 PM) from Terminal 2 on Friday. Used 2 sources [1] trip-f08.md [2] pip-f01.md
:::

Then "Save a note: pack the passport for Lisbon". The tool card said
**saveNote Failed**, and that's correct: the retrieval cut from course E
locks every writing tool for the rest of a chat once saved content has been
read, and this chat had searched. The fallback model told the user it
couldn't save "due to a technical issue". It wasn't. **The tool card is the
truth**, not the model's story about it. Start a new chat to save a note.

### 3. Deploy it yourself

We haven't deployed the reference Klippy, so there's no recorded live run.
Our dry runs printed a total upload of 4081.04 KiB (783.59 KiB gzipped) for
the agent and 991.10 KiB (197.85 KiB gzipped) for the web app. Here's the
order for yours, once:

1. **Your id only.** In `apps/web/wrangler.jsonc`, set
   `ALLOWED_GITHUB_IDS` to your own GitHub id (`gh api user --jq .id`) and
   `APP_ORIGIN` to your web app's address. Point your GitHub OAuth app's
   callback at `<that address>/auth/github/callback`.
2. **The Workers' secrets**, as in lesson 6: `KLIPPY_TOKEN` on the agent,
   and the four on the web app. They go in before any deploy.
3. **The database.** Apply the migrations to the live D1 before the code
   that needs them: `cd apps/agent && pnpm exec wrangler d1 migrations
   apply DB --remote`.
4. **The agent, then the web app.** `pnpm deploy`, then `pnpm deploy:web`,
   from the repo root. Or add the two `CLOUDFLARE_*` repository secrets and
   push to `main`: CI does steps 3 and 4 in that order.
5. **Check the side door.** `curl -i https://klippy.<subdomain>.workers.dev/`
   should no longer reach your Worker. The web app should still work, signed
   in.
6. **Set the brakes**: a spend limit on the gateway (lesson 2), and the two
   saved queries (lesson 4) once a few turns have run.

No Anthropic key on your gateway? Klippy still works on the Workers AI
fallback, as in every recording here. Add the key (AI Gateway → `default`
→ provider keys) to get Claude.

### 4. Let bits check it

Paste your **web app's** address: `klippy-web.<subdomain>.workers.dev`, or
your own domain. Not the agent's: it has none now. bits calls
`/klippy/check` there, which reaches your agent over the service binding,
and looks for this checkpoint's tag.

:::verify{id="klippy-in-production" path="/klippy/check?nonce=bits-checkpoint-f08" xp=60}
Paste the https://klippy-web….workers.dev address (or your custom domain) of your deployed web app.
- goal "Your Klippy is in production: the web app's /klippy/check answers with bits' nonce and tag f-08 (or a later one)"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-f08"/
- expect "Is at f-08 or later" match /"tag"\s?:\s?"(f-08|g-\d\d)"/
- hint "Open /klippy/check?nonce=hello-from-me on your web app's address in a browser. Does it say \"tag\":\"f-08\"?"
- hint for="Is at f-08 or later" "Set TAG = 'f-08' in apps/agent/src/check.ts, then deploy the agent again: the live Worker still runs your old code."
- hint for="Answers the check" "Paste the web app's address, not the agent's: the agent has no public address since lesson 1. A 503 means the web app has no agent binding (is it a Preview?). A 429 means too many checks: wait a minute."
:::

A pass proves a web app at that address reaches an agent that answers the
way this lesson asks. It doesn't prove who wrote it.

:::quiz{id="tool-card-truth" xp=20}
In the tour, saveNote failed and the model said it was "a technical issue". What really happened?

- [ ] The D1 database was down
  Not quite. The search a moment earlier read it fine.
- [x] The retrieval cut locked writing tools because the chat had read saved content
  Right. That's a defence working. The tool card says Failed; the model's reason was made up.
- [ ] The daily token budget ran out
  Not quite. A spent budget refuses the whole turn before the model is called.
:::

That's Klippy in production. Your code matches tag `f-08`
([changes from f-07](https://github.com/ryanyogan/klippy/compare/f-07...f-08)).

:::rabbithole
- read "D1 migrations" by="Cloudflare" url="https://developers.cloudflare.com/d1/reference/migrations/"
- read "Building effective agents" by="Anthropic" url="https://www.anthropic.com/engineering/building-effective-agents"
:::
