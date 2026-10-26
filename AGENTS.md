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

## Component catalogue (packages/ui/src)

Import as `@bits/ui/<file>`. "Island" = `clientEntry`, ships JS; everything
else is static (server-rendered, CSS-only states). Live catalogue with every
variant and state: `/styleguide` (`apps/web/app/actions/styleguide/`).
Rationale: `docs/decisions/010-component-library.md`.

| Component | File | Key props | Kind |
|---|---|---|---|
| Document | document.tsx | assets, title, description, head | static |
| AppBar | app-bar.tsx | brand, homeHref, links, currentPath, actions, variant, position | static |
| AppBarMenu | app-bar-menu.tsx | links, currentPath, label (mobile sheet <760px, native popover) | island |
| Logo / BrandMark | logo.tsx / brand-mark.tsx | brand, href, variant / size | static |
| NavLink | nav-link.tsx | href, variant, current | static |
| Icon | icon.tsx | name (`iconNames`), size, color, label | static |
| Keycap | keycap.tsx | variant primary/dark/ghost/ghost-mono/inverse/ion, size sm/md/lg, href, type, loading, glow, block, disabled | static |
| ToolButton | tool-button.tsx | variant outline/quiz/video, square, label, pressed | static |
| ProviderButton | provider-button.tsx | icon, href or type/name/value, busy | static |
| BackButton | back-button.tsx | href, label | static |
| SegmentedTabs / StaticTabs | segmented-tabs.tsx | label, items, flavour mode/account / items, selected, size | static (URL tabs) |
| TabPanels | tab-panels.tsx | label, items {name, label, panel}, defaultTab, flavour | island (@remix-run/ui tabs) |
| ChoiceChip / Chip / SuggestionChip | chip.tsx | name, value, type, defaultChecked / selected / href | static |
| FilterPill | filter-pill.tsx | href, dot, count, selected | static |
| Tag | tag.tsx | variant, color | static |
| TextField | text-field.tsx | name, label, type, value, error, hint, mono, compact | static |
| SearchField | search-field.tsx | action, name, value, label, shortcut | static |
| SearchShortcut | search-shortcut.tsx | target (input id; `/` and Cmd/Ctrl-K focus it) | island |
| CodeInput | code-input.tsx | name, length, error, autoSubmit, value | island (one input without JS) |
| Switch | switch.tsx | name, legend, options, value | static (native radios) |
| QuizChoice | quiz-choice.tsx | name, question, options, multiple, explanation, action | static (POST form) |
| Card | card.tsx | variant default/page/compact/dashed/glass, as, label | static |
| Callout | callout.tsx | tone ok/warning/danger/info, role, title, compact | static |
| Eyebrow / MonoHeading | eyebrow.tsx | tone, size, as / level, id | static |
| Kbd | kbd.tsx | decorative | static |
| StatTile | stat-tile.tsx | value, label, color, variant main/profile | static |
| KeyValueList | key-value-list.tsx | items, variant default/course | static |
| EmptyState | empty-state.tsx | title, hint, action | static |
| LiveDot | live-dot.tsx | tone, pulse | static |
| Footer | footer.tsx | brand, homeHref, links, copyright | static |
| XpPill / StreakPill / AvatarButton | xp-pill.tsx / streak-pill.tsx / avatar-button.tsx | neurons / days / initials, href, current | static |
| CourseCover / Sigil | course-cover.tsx | pattern (8 `coverPatterns`), tone volt/ion/synapse, sigil, variant card/banner/art/thumb | static |
| CourseCard / WriteCourseCard | course-card.tsx | href, title, desc, level, lessons, mins, sigil, tone, pattern, formats, pct | static |
| ContinueBanner | continue-banner.tsx | href, courseTitle, nextLesson, mins, pct, sigil, tone, pattern | static |
| ProgressBar / SegmentedProgress | progress-bar.tsx | pct, variant card/banner/art/row/level, color, label / segments | static |
| ProgressRing | progress-ring.tsx | pct, size 96/132, color, caption, label | static |
| LessonNode / LessonNodeRow | lesson-node.tsx | state done/current/next, size, n, passed / state, badge | static |
| LessonBar | lesson-bar.tsx | backHref, context, title, segments, modes, neurons | static |
| TutorAvatar / TutorMessage / LearnerBubble / ModelOutput | tutor.tsx | size / variant / variant / temperature, tokens, state done/streaming/example/error | static |
| CheckChip | check-chip.tsx | passed, compact | static |
| TokenPill / TokenizerPanel | token-pill.tsx | text, id, index / tokens | static |
| HexBadge / BadgeTile / BadgeChip | hex-badge.tsx | name, glyph, color, variant earned/locked/preview/chip | static |
| ActivityGrid | activity-grid.tsx | levels (`sampleActivity()` for demos), label | static |
| RewardToast | reward-toast.tsx | xp, message, next, variant lesson/system | static |
| RewardRegion | reward-toast.tsx | dismissAfter; shows toasts from `announceReward()` (`bits:reward`) | island |
| OddsBars | odds-bars.tsx | context, candidates, defaultValue (follows `bits:temperature`) | island |
| PromptComposer | prompt-composer.tsx | id, task, checks, temperatures, examples, reward, keepRuns | island (Enter runs, Shift+Enter newline) |
| CodeEditor | code-editor.tsx | files, highlight, focusLine, typeMode | island (@remix-run/ui tabs) |
| TerminalLog | terminal.tsx | path, entries, replies, placeholder | island |
| TerminalOutput | terminal.tsx | lines | static |
| OutputPanel | terminal.tsx | command, lines (replayed) | island |
| VideoPlayer | video-player.tsx | title, duration, chapters, cues, transcriptOpen | island (visual shell, simulated clock) |
Island rule: JSX passed as an island prop is serialized, so it must not carry
`mix` or component elements; use plain elements and let the island style them.

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
