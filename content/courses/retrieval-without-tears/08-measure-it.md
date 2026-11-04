---
# sources (checked 2026-11-03):
# - Anthropic, Demystifying evals for AI agents (measure before you tune; build the set from real tasks)
#   https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
# - Anthropic, Define success criteria and build evaluations
#   https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
# - Cloudflare, Vitest integration (remote bindings for tests that need real resources); @cloudflare/vitest-plugin 1.5.1
#   https://developers.cloudflare.com/workers/testing/vitest-integration/
# - Klippy e-07 → e-08, recorded output docs/outputs/e-08.txt (2026-11-03). No chat model is called by the eval.
#   e-08's eval wrote to and deleted from the real index: fixed at e-09 (docs/outputs/e-09.txt). This lesson tells
#   learners not to run it at this tag.
title: "Measure it"
order: 8
minutes: 25
xp: 80
module: Measure and ship
device: desk
tag: e-07
verified: 2026-11-03
versions:
  agents: "0.33.0"
  wrangler: "4.157.0"
  vitest: "5.0.5"
  "@cloudflare/vitest-plugin": "1.5.1"
---

You've stacked up chunking, vectors, keywords, RRF, context and a
reranker. Did each one help? Without a number, you're guessing. This
lesson adds the number, and a bug worth learning from.

**Don't run this lesson's eval.** At tag `e-08`, `pnpm eval:retrieval`
writes to and deletes from your **real** `klippy-notes` index, and can
destroy your real vectors. Read along, find the bug in step 4, and run the
fixed version in lesson 9.

### 1. recall@k

Take questions whose answers you know. For each, run the search and look
at the top **k** results. **recall@k** is the share of questions whose
answer is among them: 1.00 means every answer was found.

For Klippy, k = 5, because the reranker hands the model five passages. If
the answer isn't in those five, the model can't cite it, however good it
is.

### 2. A question set

`apps/agent/test/eval/corpus.ts` holds six made-up documents and twelve
questions, each with the document that answers it:

:::code{file="apps/agent/test/eval/corpus.ts" lang="ts" tag="e-08" highlight="2-5" label="apps/agent/test/eval/corpus.ts"}
export const questions: { q: string; answer: string }[] = [
	{ q: 'What vegetable does my dog like?', answer: 'pip.md' },
	{ q: 'When are the vaccinations due for the dog?', answer: 'pip.md' },
	{ q: 'What is the flight number to Portugal?', answer: 'lisbon-trip.md' },
	{ q: 'Which tram should we take early?', answer: 'lisbon-trip.md' },
...
	{ q: 'When is the quarterly review?', answer: 'work-notes.md' },
	{ q: 'How do we undo a bad release?', answer: 'work-notes.md' },
:::

Good questions are worded the way a person asks, not copied from the
document: "vegetable" for carrots, "Portugal" for Lisbon. Questions that
reuse the document's words test nothing but keyword search. Claude is good
at drafting them. Try it:

:::prompt{id="draft-test-questions" xp=20 coach}
Get Claude to draft retrieval test questions
- goal "Get Claude to write a handful of questions a real customer might ask that this passage answers, in their words rather than the passage's"
- placeholder "Here is a passage: … Write 5 questions a customer might ask that it answers. Use … words, not the passage's."
- draft "Passage: E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault."
- check "Asks for questions" /questions/i
- check "Sets how many" /\b(3|4|5|6|three|four|five|six)\b/i
- check "Includes the passage" /70%|70 ?percent/i
- check "Includes the passage" /30 days/i
- expect "Writes questions" match /\?/
- rubric "Questions sound like a customer, not reworded lines from the passage" must
- rubric "Every question is about something the passage covers" should grounded
- rubric "Questions cover different facts: how long, what's covered, and the deadline" should
- hint "A test that reuses the passage's own words is too easy for search. Who asks these questions, and how do they talk?"
- hint "Ask for questions the passage answers, and say how many. A question it can't answer tests something else."
- hint "Give the passage, ask for five questions a customer might ask that it answers, and say to use everyday words, not the passage's."
- reference "Here is a passage from our warranty guide:\n\"E-bike batteries have a 2-year warranty from delivery, covering capacity below 70%. Claims must be filed within 30 days of noticing the fault.\"\n\nWrite 5 questions a customer might ask that this passage answers. Use the words a customer would use, not the passage's wording, and cover different facts in it. Every question must be one the passage fully answers. One question per line."
- run temperature=[1.0]
- example T=1.0 "1. How long is my e-bike battery under warranty?\n2. My battery's capacity has dropped a lot. How bad does it have to be before I can claim?\n3. Does the warranty start from the day I ordered or the day the bike was delivered?\n4. I noticed a problem with my battery last week. Is there a deadline to claim?\n5. My battery is three years old. Is it still covered?"
- success "Real-sounding questions make an honest test." next="Next: the scorer →"
:::

Read every drafted question before it goes in the set. A question the
document doesn't answer measures nothing.

### 3. The scorer

`apps/agent/test/eval/recall.ts` is the whole formula:

:::code{file="apps/agent/test/eval/recall.ts" lang="ts" tag="e-08" highlight="2-5" label="apps/agent/test/eval/recall.ts"}
// recall@k: the share of questions whose answer is among the top k results. 1 means every answer was found.
export function recallAt(k: number, results: string[][], answers: string[]) {
	const found = results.filter((titles, i) => titles.slice(0, k).includes(answers[i])).length;
	return found / answers.length;
}
:::

It's pure, so `test/recall.spec.ts` checks the arithmetic in the normal
test run. Copy [`corpus.ts`](https://github.com/ryanyogan/klippy/blob/e-08/apps/agent/test/eval/corpus.ts)
and create `recall.ts` now: neither one touches an index, and both stay
the same at `e-09`.

### 4. The eval, and its bug

`test/eval/retrieval.eval.ts` ingests the corpus under a fresh owner,
runs every question four ways (keywords, vectors, hybrid, hybrid +
rerank), and prints recall@5 for each. It needs the **real** Workers AI
and Vectorize, so `vitest.eval.config.mts` turns on `remoteBindings`, and
it runs only with `pnpm eval:retrieval`, never in `pnpm test` or CI. Here's
how it sets up and cleans up at `e-08`:

:::code{file="apps/agent/test/eval/retrieval.eval.ts" lang="ts" tag="e-08" highlight="7-8" label="apps/agent/test/eval/retrieval.eval.ts"}
beforeAll(async () => {
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	for (const [title, body] of Object.entries(documents)) {
		const source = await queueSource(env.DB, { owner, kind: 'file', title, body });
		await saveChunks(env.DB, source!, chunk(body));
		const { results } = await env.DB.prepare('SELECT id, owner, source_id, context, text FROM chunks WHERE source_id = ?').bind(source!.id).all<ChunkRow>();
		await upsertChunks(env, results);
		ids.push(...results.map((row) => `chunk-${row.id}`));
...

afterAll(async () => {
	await env.VECTORIZE.deleteByIds(ids);
:::

Spot it? `upsertChunks(env, …)` writes to `env.VECTORIZE`, your **real**
index, under ids `chunk-1`, `chunk-2`, … The eval's local D1 starts
empty, so its chunk ids start at 1, the same ids your real chunks have.
The upsert **overwrites** your real vectors with the corpus, and the
cleanup **deletes** them. A fresh owner doesn't help: ids aren't scoped by
owner.

The lesson in general: **a measurement that writes gets its own
resources**. Lesson 9 gives it a separate `-eval` index, ids of its own,
and a guard that refuses to start otherwise.

### 5. What it measured

We ran it once, on a recording account whose index held only test
vectors. The numbers:

:::terminal{cmd="pnpm eval:retrieval --reporter=verbose"}
keywords only               1.00
vectors only                1.00
hybrid                      1.00
hybrid + rerank             1.00
hybrid + rerank, recall@1   [synapse]0.92[text]
ok   What vegetable does my dog like? -> pip.md
ok   When are the vaccinations due for the dog? -> pip.md
ok   What is the flight number to Portugal? -> lisbon-trip.md
ok   Which tram should we take early? -> lisbon-trip.md
ok   What pressure for the tyres? -> bike.md
ok   How often should I oil the chain? -> bike.md
ok   How much salt goes in the bread? -> sourdough.md
ok   What temperature do I bake the loaf at? -> sourdough.md
ok   When is the quarterly review? -> work-notes.md
[synapse]MISS How do we undo a bad release? -> bike.md[text]
ok   When can the tomatoes be planted outside? -> garden.md
ok   How do I get rid of slugs? -> garden.md
:::

Read it honestly: **this
set is too easy.** Every method finds every answer in its top five, so
recall@5 can't tell them apart. Only recall@1 shows a miss: "undo a bad
release" should find the rollback line in `work-notes.md`, and the
reranker put `bike.md` first.

So the next move isn't tuning. It's a **harder set**: your own saved
things, the questions you really ask, paraphrases, exact codes like
`TP1337`, near-duplicate notes. Make it hard enough that the methods
differ, then change one thing at a time and watch the number.

### 6. Prove it

Copy [`test/recall.spec.ts`](https://github.com/ryanyogan/klippy/blob/e-08/apps/agent/test/recall.spec.ts)
and run `pnpm test`: ours was 21 files, 95 tests passed. Don't copy
`retrieval.eval.ts`, `vitest.eval.config.mts` or the `eval:retrieval`
script from this tag: lesson 9 gives you the fixed ones.

:::quiz{id="eval-own-index" xp=20}
Why must the eval use its own Vectorize index, not just a fresh owner?

- [ ] A fresh owner makes the search slower
  Not quite. Speed isn't the problem. Safety is.
- [x] Vector ids aren't scoped by owner, so the eval's chunk-1 is your real chunk-1
  Right. Its upsert overwrites your vectors and its cleanup deletes them. A separate index can't touch your real one.
- [ ] Vectorize allows one owner per index
  Not quite. One index holds every owner. That's why the owner filter exists.
:::

Your code matches tag `e-08`, minus its eval files
([changes from e-07](https://github.com/ryanyogan/klippy/compare/e-07...e-08)).
Don't run its eval: lesson 9 fixes it.

:::rabbithole
- read "Demystifying evals for AI agents" by="Anthropic" url="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
- read "Define success criteria and build evaluations" by="Anthropic" url="https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
:::
