# 006. Wrangler config: compat date, no nodejs_compat, deferred bindings

Status: Accepted (2026-10-26)

## Decision

- `compatibility_date: 2026-10-19`. This is the newest date the installed
  workerd supports (from wrangler's `unstable_getDevCompatibilityDate`). A
  later date fails locally. Bump it when wrangler is upgraded.
- No `nodejs_compat`. The Worker bundle has no `node:` imports, and the build
  prints any it finds. Add the flag only if a dependency needs it.
- `main: build/worker/index.js` (prebuilt, see 002). Static assets come from
  `build/client` with `binding: ASSETS` and `not_found_handling: none`.
- D1 `DB` → `bits-db` (`163b946d-2eeb-443f-a5ed-59ad7f0a945d`),
  `migrations_dir: ../../packages/db/migrations`.
- `observability` is on: logs at 100% sampling, traces at 10%.
- `workers_dev` and `preview_urls` are on.
- Types: `pnpm cf-typegen` writes `worker-configuration.d.ts` (Env only,
  `--include-runtime false`). Runtime types come from
  `@cloudflare/workers-types` through module imports, so they do not clobber
  Node/DOM globals in the shared tsconfig.

## Deferred (not yet needed, cheap to add)

- **R2** (compiled courses, upload staging): with the course build milestone.
  Fonts are self-hosted from static assets, not R2 (they are part of the UI
  build and fingerprinted).
- **Queue / Workflows** (course builds): with the course build milestone.
- **KV** (session/catalog cache): optional. D1 first, and add KV only if
  measurements say so.
- **Per-branch preview deploys in CI**: there is no CI yet. `preview_urls` is
  enabled, so `wrangler versions upload` gives preview URLs once CI exists.
- Turnstile, AI Gateway, Stream, email sending, rate limiting: with their
  milestones.
