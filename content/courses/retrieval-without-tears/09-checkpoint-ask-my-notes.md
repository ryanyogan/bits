---
# sources (checked 2026-11-03):
# - Cloudflare D1, Migrations (migrations apply --remote)
#   https://developers.cloudflare.com/d1/reference/migrations/
# - Cloudflare Vectorize, wrangler vectorize create / create-metadata-index
#   https://developers.cloudflare.com/vectorize/reference/wrangler-commands/
# - Klippy e-08 → e-09, recorded output docs/outputs/e-09.txt (2026-11-03). The local tour, the check, the dry run and
#   the eval (against klippy-notes-eval only) are recorded; the live deploy and the remote migrations are not, and the
#   lesson says so. The Workers AI fallback (@cf/zai-org/glm-4.7-flash) answered, not Claude.
title: "Checkpoint: ask my notes"
order: 9
minutes: 30
xp: 120
module: Measure and ship
device: desk
tag: e-08
verified: 2026-11-03
versions:
  agents: "0.33.0"
  "@cloudflare/ai-chat": "0.12.2"
  ai: "7.0.162"
  wrangler: "4.157.0"
---

Klippy answers from what you saved now: links and files ingested in a
Workflow, chunks with context, hybrid search and a reranker, cited
answers, and a lock on writing once saved content is read. One fix first,
the eval from lesson 8. Then the tour, the deploy, and bits' check.

### 1. Give the eval its own index

Create a second index, only for measuring, with its owner metadata index:

```sh
pnpm exec wrangler vectorize create klippy-notes-eval --dimensions=768 --metric=cosine
pnpm exec wrangler vectorize create-metadata-index klippy-notes-eval --propertyName=owner --type=string
```

Bind it next to the real one. No app code reads it:

:::code{file="apps/agent/wrangler.jsonc" lang="json" tag="e-09" highlight="5" label="apps/agent/wrangler.jsonc"}
	"vectorize": [
		{ "binding": "VECTORIZE", "index_name": "klippy-notes", "remote": true },
		// A separate index used ONLY by `pnpm eval:retrieval` (e-09), so a measurement never writes to or deletes from your
		// real one. The app's code never reads this binding. Its name must end in -eval: the eval checks.
		{ "binding": "VECTORIZE_EVAL", "index_name": "klippy-notes-eval", "remote": true }
	],
:::

Run `pnpm run cf-typegen`. `vitest.eval.config.mts` now refuses to start
unless that binding's index name ends in `-eval`:

:::code{file="apps/agent/vitest.eval.config.mts" lang="ts" tag="e-09" highlight="3-5" label="apps/agent/vitest.eval.config.mts"}
// Guard: the eval writes and deletes vectors, so it runs only against an index whose name ends in -eval.
// (Before e-09 it used the real VECTORIZE index, and could overwrite and delete real chunks: never run e-08's eval.)
const config = readFileSync(path.join(import.meta.dirname, 'wrangler.jsonc'), 'utf8');
const evalIndex = /"binding":\s*"VECTORIZE_EVAL",\s*"index_name":\s*"([^"]+)"/.exec(config)?.[1] ?? '';
if (!evalIndex.endsWith('-eval')) throw new Error(`VECTORIZE_EVAL must point at an index named *-eval (found "${evalIndex}")`);
:::

### 2. Ids of its own, and a full wait

`upsertChunks` takes an id prefix (default `chunk-`), and `vectorSearch`
reads the chunk id from the **end** of the vector id:

:::code{file="apps/agent/src/retrieval/vectors.ts" lang="ts" tag="e-09" highlight="6" label="apps/agent/src/retrieval/vectors.ts"}
export async function upsertChunks(env: Env, rows: ChunkRow[], prefix = 'chunk-') {
	if (rows.length === 0) return 0;
	// The context sentence goes in front of the chunk, so the vector carries where the chunk came from.
	const vectors = await embed(env, rows.map((row) => (row.context ? `${row.context}\n\n${row.text}` : row.text)));
	await env.VECTORIZE.upsert(
		rows.map((row, i) => ({ id: `${prefix}${row.id}`, values: vectors[i], metadata: { owner: row.owner, sourceId: row.source_id } })),
	);
	return rows.length;
}

// The chunk ids whose meaning is closest to the question, from this owner's vectors only.
export async function vectorSearch(env: Env, owner: string, question: string, topK = 20): Promise<number[]> {
	const [vector] = await embed(env, [question]);
	const { matches } = await env.VECTORIZE.query(vector, { topK, filter: { owner } });
	return matches.map((match) => Number(/(\d+)$/.exec(match.id)?.[1])).filter(Number.isInteger); // the chunk id ends the vector id
:::

Then the eval runs everything on a copy of `env` whose `VECTORIZE` is the
eval index, and deletes only its own prefixed ids, only from there:

:::code{file="apps/agent/test/eval/retrieval.eval.ts" lang="ts" tag="e-09" highlight="1-4" label="apps/agent/test/eval/retrieval.eval.ts"}
if (!String(env.EVAL_INDEX).endsWith('-eval')) throw new Error('Refusing to run: VECTORIZE_EVAL is not an *-eval index.');
const evalEnv = { ...env, VECTORIZE: env.VECTORIZE_EVAL } as Env;
const owner = `eval-${Date.now()}`;
const prefix = `${owner}-chunk-`;
const ids: string[] = [];
...
		await upsertChunks(evalEnv, results, prefix);
		ids.push(...results.map((row) => `${prefix}${row.id}`));
...
	// Vectorize is eventually consistent: wait until a search sees ALL of this run's vectors (up to 3 minutes). Before
	// e-09 it waited for the first one only, so "vectors only" could be measured on a half-built index.
	for (let i = 0; i < 36 && (await vectorSearch(evalEnv, owner, 'Pip', 50)).length < ids.length; i++) await new Promise((r) => setTimeout(r, 5000));
...
afterAll(async () => {
	if (ids.every((id) => id.startsWith(prefix))) await env.VECTORIZE_EVAL.deleteByIds(ids);
});
:::

Three guards, so one mistake can't reach your real vectors: the config
check, the check in the file, and the prefix check before deleting. And
one more fix: the eval used to wait for the **first** vector to be
searchable, and once measured "vectors only 0.17" on a half-built index.
Now it waits for **all** of them.

Copy [`vectors.ts`](https://github.com/ryanyogan/klippy/blob/e-09/apps/agent/src/retrieval/vectors.ts),
the eval files ([`test/eval/`](https://github.com/ryanyogan/klippy/tree/e-09/apps/agent/test/eval)
and [`vitest.eval.config.mts`](https://github.com/ryanyogan/klippy/blob/e-09/apps/agent/vitest.eval.config.mts)),
[`test/vectors.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-09/apps/agent/test/vectors.spec.ts)
and [`test/env.d.ts`](https://github.com/ryanyogan/klippy/blob/e-09/apps/agent/test/env.d.ts).
Now it's safe to measure:

:::terminal{cmd="pnpm eval:retrieval --reporter=verbose"}
⎔ Establishing remote connection...
Using secrets defined in .dev.vars
stdout | test/eval/retrieval.eval.ts > recall@5 over 12 questions
keywords only               1.00
vectors only                1.00
hybrid                      1.00
hybrid + rerank             1.00
hybrid + rerank, recall@1   0.92
:::

The same numbers as lesson 8, now from `klippy-notes-eval` only. Then the
real work starts: replace the corpus with your own.

### 3. Name the tag

In `apps/agent/src/check.ts` (and `test/check.spec.ts`):

:::code{file="apps/agent/src/check.ts" lang="ts" tag="e-09" highlight="2" label="apps/agent/src/check.ts"}
// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'e-09';
:::

Run `pnpm test`: ours was 21 agent test files, 96 tests passed.

### 4. The tour

Locally, with a Klippy that has `pip.md`, the UI brief and `trip.md` saved
(the Workers AI fallback answered, not Claude):

:::terminal{cmd="KLIPPY_URL=http://localhost:8801 pnpm chat me"}
you> /clear
you> What day is my Lisbon flight? Check my notes.
[synapse]klippy>[text] Your Lisbon flight is on a Friday [volt][1][text].
you> What is my bank PIN? Check my notes.
[synapse]klippy>[text] That's not in your notes.
:::

A fresh name, with nothing saved, gets "That's not in your notes." for
both: every search comes back empty. That's the owner wall, not a bug.

### 5. Ship it

Course E added four D1 migrations (`0002` to `0005`), and the live
database doesn't have them yet. Apply them **before** the deploy, or the
new code meets old tables:

```sh
pnpm exec wrangler d1 migrations apply klippy-db --remote
pnpm exec wrangler deploy
```

The `klippy-notes` index has been remote all along, and the `IngestWorkflow`
is created by the deploy. If you use the web app from course D, deploy it
too (`pnpm deploy:web` from the repo root): it shows the `[n] title`
sources.

**What we recorded, and what we didn't.** We haven't applied the remote
migrations or deployed the reference Klippy, so there's no recorded live
run. Our dry run (`pnpm exec wrangler deploy --dry-run`) printed a total
upload of 4076.39 KiB (781.91 KiB gzipped), with the two new bindings
among the rest: `env.INGEST (IngestWorkflow)`, a Workflow, and
`env.VECTORIZE (klippy-notes)`, a Vectorize index. And the check, locally:

:::terminal{cmd="curl -s 'http://localhost:8801/klippy/check?nonce=checkpoint-e09'"}
{"nonce":"checkpoint-e09",[volt]"tag":"e-09"[text],"probe":{"answer":"Hi bits! You're looking incredibly elegant in binary.","model":"@cf/zai-org/glm-4.7-flash"}}
:::

### 6. Let bits check it

Paste your agent Worker's address. bits calls `/klippy/check` on it and
looks for this checkpoint's tag.

:::verify{id="klippy-asks-your-notes" path="/klippy/check?nonce=bits-checkpoint-e09" xp=60}
Paste the https://….workers.dev address that `wrangler deploy` printed.
- goal "Your Klippy is live at this checkpoint: /klippy/check answers with bits' nonce and tag e-09 (or a later one)"
- expect "Answers the check" json keys=nonce,tag,probe
- expect "Echoes bits' nonce" match /"nonce"\s?:\s?"bits-checkpoint-e09"/
- expect "Is at e-09 or later" match /"tag"\s?:\s?"(e-09|[f-g]-\d\d)"/
- hint "Open /klippy/check?nonce=hello-from-me on your address in a browser. Does it say \"tag\":\"e-09\"?"
- hint for="Is at e-09 or later" "Set TAG = 'e-09' in apps/agent/src/check.ts, then deploy again: the live Worker still runs your old code."
- hint for="Answers the check" "A 429 means the check was called too often: wait a minute. A 500 can mean the deploy met old tables: apply the remote migrations, deploy again, and run wrangler tail."
:::

A pass proves a Worker at that address answers the way this lesson asks.
It doesn't prove who wrote it.

:::quiz{id="eval-guards" xp=20}
Someone points VECTORIZE_EVAL at klippy-notes by mistake. What happens when they run pnpm eval:retrieval?

- [ ] It runs, but deletes only the eval's own ids
  Not quite. It doesn't get that far.
- [x] It refuses to start: the index name doesn't end in -eval
  Right. The config and the eval file both check the name before anything is written.
- [ ] It overwrites the real vectors, as at e-08
  Not quite. That's the bug lesson 9 fixed.
:::

That's Klippy answering from your notes. Your code matches tag `e-09`
([changes from e-08](https://github.com/ryanyogan/klippy/compare/e-08...e-09)).

:::rabbithole
- read "D1 migrations" by="Cloudflare" url="https://developers.cloudflare.com/d1/reference/migrations/"
- read "Introducing Contextual Retrieval" by="Anthropic" url="https://www.anthropic.com/engineering/contextual-retrieval"
:::
