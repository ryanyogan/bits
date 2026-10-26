# Bits Agent Guide

bits is a free AI-learning web app: Remix 3 (`remix@3.1`, not React, not
Remix v2) on Cloudflare Workers + D1, in a pnpm monorepo. The product spec is
`docs/handoff.md`. It was written for "Latent", and the name is now bits (see
`docs/decisions/005-name-bits.md`). Designs are in `docs/design/` (artboards
plus `spec/*.md`). Decisions are in `docs/decisions/`. Read the relevant ones
before changing architecture, and add a new record when you make a decision.

Remix: read `./.agents/skills/remix/SKILL.md`, then find guides and API
READMEs through `apps/web/node_modules/remix/INDEX.md`. The installed docs are
canonical. Do not use `@remix-run/react`, React Router or Next.js patterns.

## Commands (repo root)

```sh
pnpm i
pnpm dev                  # Node server + server/browser HMR on http://localhost:44100
pnpm dev:restart          # Node server, restart on change (no HMR)
pnpm test                 # all packages (remix test; db tests run real D1 in Miniflare)
pnpm typecheck            # all packages
pnpm build                # apps/web/build: client assets + Worker bundle
pnpm preview              # build, then run the real Worker under wrangler dev
pnpm deploy               # build, then wrangler deploy → https://bits.ryanyogan.workers.dev
pnpm db:migrate:local     # wrangler d1 migrations apply (local state shared by dev and preview)
pnpm db:migrate:remote
pnpm db:seed:local        # demo user demo@bits.local / @demo
pnpm cf-typegen           # regenerate apps/web/worker-configuration.d.ts after wrangler.jsonc changes
pnpm remix:doctor         # `pnpm doctor` is pnpm's own builtin
```

## Layout

```
apps/web/                 @bits/web: the Remix app and Worker
  app/routes.ts           URL contract: nested route maps, one per page area
  app/router.ts           middleware + router.map(routes.<area>, controller) per area
  app/config.ts           APP_NAME ("bits"), tagline, pageTitle(); the only place the name lives
  app/actions/            controllers: controller.tsx (root) and <area>/.../controller.tsx
  app/actions/**/public/  browser modules (clientEntry components, entry.ts)
  app/ui/                 app-level shared UI: Layout, PlaceholderPage, FormField
  app/middleware/         database.ts puts the data-table db on context.db
  app/platform/           runtime seam: `#platform` → platform.node.ts | platform.worker.ts
  scripts/build.ts        asset crawl into build/client + esbuild Worker bundle
  worker.ts               Workers entry; server.ts / hmr.ts are the Node entries
  wrangler.jsonc          Worker "bits", D1 DB=bits-db, static assets, observability
packages/ui/              @bits/ui: tokens, fonts, base CSS, design-system components
packages/db/              @bits/db: migrations/, tables.ts, D1 driver, queries/
```

## Adding a page

1. Add or extend a nested map in `app/routes.ts`, e.g.
   `badges: route('/badges', { index: get('/') })`.
2. Create `app/actions/badges/controller.tsx`:
   `export default createController(routes.badges, { actions: { index(context) { return context.render(<BadgesPage />) } } })`.
   Put page components next to it (`badges-page.tsx`), wrap them in `Layout`
   from `app/ui/layout.tsx`, and use `context.db` for data.
3. Map it in `app/router.ts`: `router.map(routes.badges, badgesController)`.
4. Add a case to `app/actions/controller.test.ts` (or a test next to the
   controller). Run `pnpm test`, `pnpm typecheck` and `pnpm remix:doctor`.
5. Forms: use a native `<form method="post" action={routes.x.action.href()}>`,
   put a `remix/data-schema/form-data` schema in `schema.ts` next to the
   controller, re-render 422 with `parsed.issues` on failure, and redirect
   303 on success. See `app/actions/login/` for the pattern.
6. Existing placeholder pages: replace `PlaceholderPage` in that area's
   controller with the real page.

## Building components (packages/ui)

- One component per file, kebab-case filename, named export:
  `src/keycap.tsx` exports `Keycap`. Import it as `@bits/ui/keycap`.
- Components are Remix components: `function X(handle: Handle<Props>) { return () => <jsx/> }`,
  reading `handle.props` inside the render function.
- Styles: `css({...})` mixins at module scope, applied with `mix={style}`
  (pass arrays to compose). Accept a `mix` prop so callers can extend a
  component.
- Use tokens only: `var(--volt)`, `var(--space-4)`, `var(--radius-md)` and so
  on, from `src/styles/tokens.css`. If the design needs a value with no token,
  add the token (sourced from `docs/design/artboards/System.dc.html` /
  `docs/design/spec/`). Do not inline the literal.
- Cascade layers: `reset, tokens, base, rmx-reset, rmx, app`. Your `css()`
  lands in `rmx` and beats base styles. Never use `!important`.
- Focus: rely on the global `:focus-visible` ring. If a component sets
  `box-shadow`, add `var(--focus-ring)` to it on `&:focus-visible`.
  Respect `prefers-reduced-motion`. Touch targets are at least
  `var(--touch-target)` (44px).
- Interactive pieces are islands. Wrap them as
  `export const X = clientEntry(import.meta.url, function X(handle) {...})`.
  The file must contain the literal `clientEntry(` (the Workers build finds
  islands by scanning for it), and the function must be named. Keep islands
  small: the server-rendered parent passes them props, as in
  `app-bar-menu.tsx`.
- Server-only components (no browser JS) are the default. `Document`,
  `AppBar` and `Keycap` are examples.
- Do not import Node APIs or app code from `packages/ui`. The app passes
  assets and brand in as props.
- New global CSS files go in `src/styles/` and `stylesheetFiles` in
  `src/assets.ts`. New fonts go through `scripts/copy-fonts.ts`.

## Data (packages/db)

- Schema changes: add `packages/db/migrations/NNNN_name.sql`, update
  `src/tables.ts` in the same commit, then run `pnpm db:migrate:local` and
  `pnpm --filter @bits/db test`. Run `pnpm db:migrate:remote` before
  deploying code that needs the change.
- D1 has no interactive transactions. `db.transaction()` throws, so use
  `context.db.batch([...])` for atomic multi-writes (see
  `docs/decisions/003-data-table-on-d1.md`).
- Typed query helpers go in `src/queries/<area>.ts` and take the `Database`
  as their first argument.

## Runtime rules

- App code never branches on Node vs Workers. Runtime differences belong in
  `app/platform/` behind `#platform`.
- Do not import `node:*`, `wrangler` or `remix/assets` from app code. Only
  `platform.node.ts`, `asset-plan.ts` and `scripts/` may. The Worker bundle
  has no `nodejs_compat`.
- Bindings come from `platform.env` (typed by `worker-configuration.d.ts`).
  Secrets go in `apps/web/.dev.vars` locally and `wrangler secret put`
  remotely.
- Anything Workers-specific must be checked with `pnpm preview` before
  deploying.
