# QA and review: Give your model tools (course B, rebuilt), 2026-11-04

Reviewer roles T (fresh learner) and V (steel-man), in one pass.

## How it was checked

- **T:** every file that each Klippy tag changes (b-01 → b-09) was compared with what the lesson tells the learner to touch, to find steps a learner would miss. The snippets themselves are proven by the snippet check: 59 tagged snippets in A+B match Klippy. Changed test files were diffed to see whether a learner's older copies would break.
- **V:**
  - Forced `tool_choice` was checked against Anthropic's define-tools and errors pages (Firecrawl, 2026-11-04). Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 return a 400; Haiku 5.5 accepts it and skips thinking. This matches L6.
  - `webFetchTool` was checked against Cloudflare's web-fetch page and the installed `agents@0.33.0` docs: Beta, the `<untrusted_web_content>` wrapper, private/link-local blocking including 169.254.169.254, and `maxRedirects` 0–20. This matches L8. The docs add that names aren't DNS-resolved, and that deployed Workers can't reach private networks anyway.
  - The lethal trifecta definition matches Simon Willison's post.
- **Coach eval:** `coach:eval --course give-your-model-tools` scored 60/60 (100%) after the fixes.

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | must | L9 §3 | `test/check.spec.ts` expects `tag: 'a-05'`, so after the learner sets `TAG = 'b-09'`, `pnpm test` fails. The lesson never mentions the test. | Tell the learner to copy `apps/agent/test/` from `b-09` (or edit the tag in the spec) before running the tests. |
| 2 | should | course-wide | Several tags grow earlier test files the lessons don't mention (`weather.spec` at b-03; `tools.spec` at b-05, b-08 and b-09; `check.spec` at b-05; `ask.spec` at b-06). Only #1 breaks, but learners drift. | L2 now sets one habit for the course: copy the whole `apps/agent/test/` folder at each lesson's tag. |
| 3 | should | L5 §3 | "clone Klippy next to your folder" gave no clone command. | Added `git clone --branch b-05 https://github.com/ryanyogan/klippy ../klippy-ref` and the `cp`, and said to keep the clone for copying tests. |
| 4 | should | L8 §4 | "So a page can never make Klippy read your notes": at b-08 the cut is `activeTools` only, which limits what the model is offered but doesn't stop execution. Fix one (exact links, no redirects) is the real guarantee. | Reworded: fix one is the guarantee, fix two is defence in depth, and course C makes the tools refuse outright (Klippy c-07). |
| 5 | nit | L8 §2 | The trifecta credit was only in the rabbit hole. | Linked Simon Willison's post inline. |
| 6 | blocker (owner) | all | The GitHub links (test files, the driver clone, compare links) 404 until `ryanyogan/klippy` is public. | Not a lesson fix. Make the repo public before publishing. |

## Checked and fine

- `:::verify` in L9: `/klippy/check?nonce=bits-checkpoint-b09`. The tag regex `(b-09|[c-g]-\d\d)` matches `TAG = 'b-09'` in Klippy `b-09:apps/agent/src/check.ts`. The probe gets no tools (`ask(env, …, {})`), so the public route can't write a note.
- Honesty: each recording names the fallback model. The Open-Meteo numbers are labelled real and dated, and the deploy is a labelled dry run. Lesson 8 notes the fallback once answered from memory.
- The new `ai` names are taught: `onStepEnd` (with `onStepFinish` called a deprecated alias) and `isStepCount` (with `stepCountIs` called an alias). "The driver is included in the repo" is there, as asked.
- Format: small explained snippets, every lesson ends with something to run, and build steps are marked `device: desk`.
