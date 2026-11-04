# QA and review: Your first Worker (course A), 2026-11-04

Reviewer roles T (fresh learner) and V (steel-man), in one pass.

## How it was checked

- **T:** lessons 2–5 were replayed literally in a scratch folder (Node 24.22.2, pnpm 10.34.9 through Corepack):
  - `pnpm create cloudflare@2.74.8 … --no-agents`, then deleting c3's lockfile and workspace file, then `pnpm install`;
  - every file built from the lesson's snippets and prose;
  - `pnpm typecheck` and `pnpm test`;
  - `wrangler dev` on ports 8810–8812 with curl against `/`, `/nope`, `/ask` (401, 200 and 400) and `/klippy/check` (a fresh probe, a cached second call in 3 ms, and a 400 on a bad nonce);
  - `wrangler deploy --dry-run` (818.90 KiB, the same as the recording).
  - Live `/ask` answers came from the Workers AI fallback, as the lessons label them.
  - Lesson 1 needs only the tools themselves. No deploy was made.
- **V:** model ids, BYOK and gateway behaviour, the Rate Limiting binding, secrets and the webfetch facts were checked against current docs (Firecrawl, maxAge 0, 2026-11-04). The `:::verify` block was checked against Klippy `a-05:apps/agent/src/check.ts`.

## Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | must | L5 §6 | `pnpm test` fails 7 of 14: `/ask` now needs a token, but the lesson never adds the tests' token to `vitest.config.mts` and never says to update `ask.spec.ts`. Reproduced in the replay. | Added a tagged `vitest.config.mts` snippet (`miniflare: { bindings: { KLIPPY_TOKEN: "test-token" } }`) and an instruction to copy `apps/agent/test/` at `a-05`. The replay then passes 14/14. |
| 2 | must | L2 §5 | c3 writes `"test": "vitest"` (watch mode) and `^` ranges. The lesson shows `vitest run` and exact versions but never tells the learner to change them, so in lesson 3 `pnpm test` never exits. | Made it an explicit edit ("Edit your `apps/agent/package.json` so these two blocks match", then `pnpm install`), with a note on what happens if it's skipped. |
| 3 | should | L2 §5 | "Change yours too", for the Worker name, was buried in a bullet. | It's now a bold instruction. |
| 4 | should | L5 §3 | The learner adds `import { check } from './check'` in step 3, but `check.ts` only arrives in step 5, so dev reload and typecheck break in between. | The import moved to step 5. |
| 5 | should | L4 §7 | "add `remoteBindings: false` to `vitest.config.mts`" was prose only, with no indication where. | Added a tagged snippet. |
| 6 | nit | L4 §4 | "Claude needs your Anthropic key" leaves out the gateway's own credits, which the gateway error itself mentions ("add money to your gateway or use BYOK"). | Added "(or credits added to the gateway itself)". |
| 7 | blocker (owner) | L2–L5 | Every GitHub link (compare links, test files to copy, "Start from" banners) 404s until `github.com/ryanyogan/klippy` is public. L4 and L5 need test files from it. | Not a lesson fix. Make the repo public before publishing the course. |

## Checked and fine

- `:::verify` in L5: `/klippy/check?nonce=bits-checkpoint-a05`. The nonce fits `^[A-Za-z0-9_-]{8,64}$`. `json keys=nonce,tag,probe` matches the response, and the tag regex `[a-g]-\d\d` matches `a-05`. The route is public by design, with its probe cached for 5 minutes behind a global limiter key.
- The security asides match the code:
  - a-04: runtime type check, 2,000-character cap, `messages` and not a pasted prompt, `maxOutputTokens`.
  - a-05: a bearer secret compared via SHA-256 and `timingSafeEqual`, failing closed when unset; the limiter described as "a brake, not a bill cap"; AI Gateway spend limits pointed to.
- Honesty: every recorded answer says it came from the Workers AI fallback. The deploy is a labelled dry run.
- Format: snippets are small and explained (all 59 tagged snippets in A+B match Klippy), and every lesson ends with something to run.
