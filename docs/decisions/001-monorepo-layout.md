# 001. Monorepo layout

Status: Accepted (2026-10-26)

## Context

The starter was a single Remix 3 app. The handoff asks for a design system
built from `System.dc.html` and a D1 data layer. Both are shared by every
page, and later by build jobs (course compiler, Queue consumer) that are not
page code.

## Decision

pnpm workspace (`pnpm@11`, `pnpm-workspace.yaml`):

- `apps/web` (`@bits/web`): the Remix 3 app, Worker entry, wrangler config,
  build script.
- `packages/ui` (`@bits/ui`): tokens, fonts, base CSS, components. TypeScript
  source, no build step. The app imports `@bits/ui/<component>`.
- `packages/db` (`@bits/db`): SQL migrations, data-table definitions, D1
  driver, typed queries. No build step.

Packages export `.ts`/`.tsx` source directly. Node runs it through
`remix/node-tsx`, the asset server compiles it for browsers, esbuild bundles
it for the Worker. A shared `tsconfig.base.json` holds compiler options.

`bun.lock` was removed. pnpm is the only package manager. `remix` is also a
root devDependency so that the asset server, which is rooted at the repo root,
can resolve `remix/*` browser modules (pnpm does not hoist).

## Consequences

- Workspace packages are plain source. Anything they import must work in
  Node, workerd and (for `packages/ui`) the browser.
- `pnpm <script>` at the root delegates to `@bits/web` with `pnpm --filter
  @bits/web run <script>`. `pnpm doctor` is a pnpm builtin, so the Remix
  doctor is `pnpm remix:doctor`.
