# 004. Dev runtime: Node + getPlatformProxy

Status: Accepted (2026-10-26)

## Context

Remix 3's dev loop (`remix/node-hmr`, component HMR, on-demand asset
compilation) runs on Node. Production runs on workerd. Dev code still needs
the Cloudflare bindings (D1 now; R2/KV/Queues later).

## Decision

- `pnpm dev` (= `pnpm hmr`) runs the Node server under `remix/node-hmr` with
  server and browser HMR. `pnpm dev:restart` uses `node --watch` instead.
- Bindings in Node come from wrangler's `getPlatformProxy()`, which reads
  `wrangler.jsonc` and persists to `apps/web/.wrangler/state/v3`. That is the
  same local D1 that `wrangler dev` and `wrangler d1 ... --local` use, so
  `pnpm db:migrate:local` and `pnpm db:seed:local` feed both. Tests get
  in-memory bindings (`persist: false`).
- Runtime-specific code sits behind one conditional import, `#platform`
  (package.json `imports`). `workerd` resolves to `platform.worker.ts`, and
  everything else to `platform.node.ts`. Both export a `Platform` with `env`,
  `assets` (script entries, stylesheet and font hrefs) and a runtime
  middleware. App code never branches on the runtime.
- `pnpm preview` builds and runs the real Worker under `wrangler dev`.

## Consequences

- Node and workerd differ (globals, `node:` APIs). Anything
  Workers-specific must be tested under `pnpm preview` before it ships.
- Node-only modules (`wrangler`, `remix/assets`, `node:*`) may only be
  imported from `platform.node.ts`, `asset-plan.ts` and scripts. If one
  leaks into the Worker bundle, the build fails or `nodejs_compat` becomes
  necessary.
