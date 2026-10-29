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

## Why bits exists (read before writing any lesson)

bits teaches AI engineering to everyone, for free. It distils the owner's
years of hands-on experience with AI into the shortest path from "I've heard
of LLMs" to "I build with them". It's for the engineer on the go: someone who
wants to get running, and doesn't have 100 hours or $2k for a course.

Quality bar for every lesson:

- **Best-in-class sources only.** Ground every claim in official or
  top-tier material: Anthropic's docs, courses and research; AI Hero (Matt
  Pocock); Theo (t3.gg); 3Blue1Brown; Andrej Karpathy; and the providers'
  own docs. Never rely on hearsay, outdated blog posts or unverified memory.
  Check model names, prices and API details against current docs when
  writing, and date them.
- **Distilled, not diluted.** Each lesson is 5–8 minutes long and teaches one
  idea well. It shows that idea with a toy or a live exercise and states
  current best practice, not history.
- **Start with Claude.** Learners use Claude first, in the in-app sandbox.
  Examples use Claude unless a lesson is about comparing providers.
- **Original words, credited ideas.** Write our own explanations, link to the
  best source in "Down the rabbit hole", and never copy another course's
  text or code.
- **Honest.** Say what models can't do, label illustrative toys as
  illustrative, and never fake a live result.

## Sub-agents

Work is split across sub-agents, each in its own git worktree, and the lead
session merges their branches.

- **Hand off at about 250k tokens.** When your context nears 250k tokens
  (err early), stop starting new work. Commit what's done on your branch,
  and write a handoff note: the goal, what's done (with commits), what's
  left, and any gotchas. Return the note's path. The lead starts a fresh
  agent from it.
- **Stay in your lane.** Edit only the files your brief gives you. If a
  fix needs a file outside it, note it in your report instead.
- **Run your own server.** Use `PORT=<your port> pnpm dev:restart`, never
  the default 44100. In Chrome, open your own tab and close it when you're
  done.
- **Report faithfully.** Say what you verified and how. Surface anything
  you couldn't do, including denied permissions, instead of working around
  it.

## Commands (repo root)

```sh
pnpm i
pnpm dev                  # Node server + server/browser HMR on http://localhost:44100
pnpm dev:restart          # Node server, restart on change (no HMR)
pnpm test                 # all packages (remix test; db tests run real D1 in Miniflare)
pnpm typecheck            # all packages
pnpm build                # apps/web/build: client assets + Worker bundle
pnpm preview              # build, then run the real Worker under wrangler dev
pnpm deploy               # manual fallback: build, then wrangler deploy → https://bits.yogan.dev (CI deploys master)
pnpm db:migrate:local     # wrangler d1 migrations apply (local state shared by dev and preview)
pnpm db:migrate:remote    # manual fallback: production migrations (CI runs them before each deploy)
pnpm db:seed:local        # demo user demo@bits.local / @demo, then upload + publish content/courses/*
pnpm content validate <dir…>            # build course folders, print path:line problems
pnpm content upload <dir…> [--publish]  # save as the next version unless unchanged (local; --remote for deployed, --preview for the Workers Previews DB/bucket; --force)
pnpm og                   # screenshot /cards/* into apps/web/public/og/*.png + app/ui/og-cards.generated.ts (commit both)
pnpm cf-typegen           # regenerate apps/web/worker-configuration.d.ts after wrangler.jsonc changes
pnpm remix:doctor         # `pnpm doctor` is pnpm's own builtin
```

Deploys (decision 032) happen in CI (`.github/workflows/ci.yml`), after the
`check` job (typecheck, test, build) passes:

- **Push to master** → `deploy` job (GitHub Environment `production`):
  `wrangler d1 migrations apply DB --remote`, `wrangler deploy` of the
  checked build, `pnpm content upload --all --publish --remote` (decision
  036: only courses whose build changed get a version; a course with
  errors fails the job after the others are handled), then a smoke test
  (`/health`, `/`, `/courses`, `/login` must be 200; it runs whenever the
  deploy step succeeded). Deploys never overlap and are never cancelled.
  Migrations run before the code, so keep them additive.
- **Same-repo pull request** → `preview` job (Environment `preview`): a
  Workers Preview at `https://pr-<n>-bits.ryanyogan.workers.dev`,
  commented on the PR. It runs on the separate `bits-preview-db` /
  `bits-preview-content`, shared by all previews and never production
  (`previews` block in `wrangler.jsonc`). It migrates and publishes
  `content/courses/` there only (`scripts/preview.ts migrate`,
  `pnpm content upload --all --publish --preview`). Previews send no
  mail and make no live runs. Sign-in shows its code on the page instead
  (decision 038: `isPreview()` needs `APP_ENV=preview`, no
  `CANONICAL_ORIGIN` and no `EMAIL`; `checkPreviewMode()` guards the
  config). Other mail is dropped there, and OAuth is hidden. Fork and
  Dependabot PRs get `check` only. `preview-cleanup.yml` deletes the Preview when the PR closes.
- Secrets (in both Environments): `CLOUDFLARE_API_TOKEN`, an
  account-owned token with Workers Scripts Edit, D1 Edit, Workers R2
  Storage Edit, Account Settings Read, and Workers Routes Edit on
  yogan.dev; and `CLOUDFLARE_ACCOUNT_ID`.
- Manual fallback: `pnpm db:migrate:remote && pnpm deploy` (needs
  `wrangler login`), then `pnpm content upload --all --publish --remote`. Roll back code with
  `pnpm --filter @bits/web exec wrangler rollback`; migrations stay.
- Never point the `previews` block at `bits-db` or `bits-content`.
  `scripts/lib/preview-resources.ts` refuses that, and its tests cover it.
  A new rate-limit tier goes in both `ratelimits` lists (production
  2xxx, previews 3xxx).

## Layout

```
apps/web/                 @bits/web: the Remix app and Worker
  app/routes.ts           URL contract: nested route maps, one per page area
  app/router.ts           middleware + router.map(routes.<area>, controller) per area
  app/config.ts           APP_NAME ("bits"), tagline, pageTitle(); the only place the name lives
  app/actions/            controllers: controller.tsx (root) and <area>/.../controller.tsx
  app/actions/**/public/  browser modules (clientEntry components, entry.ts)
  app/ui/                 app-level shared UI: Layout, PlaceholderPage
  app/middleware/         database.ts puts the data-table db on context.db
  app/auth/               sessions, identity, email sign-in, OAuth, mailer (server-only)
  app/progress/           lesson checks, progress store + anonymous merge, badges, levels, days
  app/content/            published courses: compile/ (markdown → JSON), store.ts (R2 + D1), catalog.ts, request.ts
  app/runs/               /api/run: model.ts (the only provider call), run.ts (limits, journal, fallback)
  app/video/              lesson MP4s in R2: upload.ts (multipart via the Worker), serve.ts (/media, Range), link.ts (build lookup)
  app/test/auth.ts        test helpers: signIn, fetchAs, requestCode
  app/platform/           runtime seam: `#platform` → platform.node.ts | platform.worker.ts
  scripts/build.ts        asset crawl into build/client + esbuild Worker bundle
  scripts/content.ts      content CLI (validate / upload); scripts/lib/ reads course folders
  scripts/preview.ts      CI: check the `previews` block, migrate the preview D1 (decision 032)
  worker.ts               Workers entry; server.ts / hmr.ts are the Node entries
  wrangler.jsonc          Worker "bits", D1 DB=bits-db, R2 CONTENT=bits-content, static assets, observability
packages/ui/              @bits/ui: tokens, fonts, base CSS, design-system components
packages/db/              @bits/db: migrations/, tables.ts, D1 driver, queries/
content/courses/<slug>/   course sources: course.md + NN-lesson.md (+ assets/*.vtt)
content/fixtures/         deliberately broken folders for tests
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
7. Grid layout (decisions 047, 050): the page brings its own `<PageFrame>`
   as a top-level child of `Layout` (Layout detects it and gives `<main>`
   the framed style, so no `bleed` is needed). Inside it, start with
   `PageHead` (`app/ui/page-head.tsx`: strip, `<h1>`, lead) and lay the
   rest out as `RuledSection`s with `CellGrid`s and `Panel`s. Each
   section is a framed plate (its own rails, a rule above and below, `+`
   marks at the corners) with `--section-gap` of ground above it; give a
   section `rule={false}` to join it to the block above (the band under
   the app bar, a grid under its toolbar). No closing section is needed.
   A 4xx with nothing else to show uses `StatusPage`
   (`app/ui/not-found-page.tsx`). Use the shared strip (`RuledSection
   label` + `labelAs="h2"`, or `Panel`) instead of a local copy, and keep
   the 12px phone inset: no page drops the frame's gutter or the rails.

## Client navigation (decision 020)

The browser runtime intercepts same-origin links and forms and reconciles
the new page into the old DOM. Write for that:

- A link that leaves the origin (an OAuth start) or a form whose answer
  isn't a page (JSON) needs `data-rmx-document`. Use `<Keycap document>`
  for keycaps. A file link needs `download` (`<Keycap download>`).
- Islands keep their setup state when the next page puts them in the same
  spot. Reset per-page state with a `data-rmx-key` on a wrapping element,
  as the lesson `<main>` does (`view.key`).
- Pending UI resets on `handle.frame`'s `reloadComplete`, not only on
  `pageshow` (`@bits/ui/pending-submit`).
- Every native form already gets pending feedback (decision 024):
  `app/actions/public/navigation-feedback.ts` marks the form
  `data-pending` and its submitter `aria-busy`, drops a second POST, and
  shows the top progress bar on slow navigations. Keycap draws its caret
  from `aria-busy`. A custom submit button should style `[aria-busy="true"]`.
  Use `PendingSubmit` only when the label should change.
- After a 422, put `autoFocus` on the first invalid field (the
  navigation's focus reset lands there). Forms that re-render in place
  (search, quiz) set `data-rmx-reset-focus="manual"`.
- Re-render failures as 4xx pages, not 5xx: the runtime treats a 5xx as a
  failed navigation. `entry.ts` then falls back to a document load.
- Cover the enhanced path with an e2e test (`app/*.test.e2e.ts`, Playwright
  via `remix test`).

## Accessibility (decision 031)

- `app/a11y.test.e2e.ts` runs axe-core on every page type and on key
  states at 360×800 and 1440×900, in the dark and light schemes. A serious
  or critical violation fails `pnpm test`. When you add a page, toy or
  state, add it there: `publicPages` for signed-out pages, or an `it` for
  signed-in or interactive states. Run it alone with
  `cd apps/web && NODE_ENV=test npx remix test a11y`.
- axe is injected with `page.evaluate` (DevTools protocol), so it works
  under the strict CSP. Never add test markup or loosen the policy for it.
- An `aria-label` on a control with visible text must contain that text
  (WCAG 2.5.3), e.g. `Your profile, RY` or `CC: captions`.
- A box that scrolls sideways takes `tabIndex={0}`, plus a role and name.
- Live regions stay rendered while empty, never `display: none`. Text that
  is already there on load isn't announced: render it outside the region
  and move it in after hydration (`RewardRegion`'s `initial`).
- A page's `<main id="main">` takes `tabIndex={-1}`, so the skip link
  moves focus into it.

## Responses (decisions 020, 027)

- HTML never gets an `ETag` or `Last-Modified` (decision 045: the
  per-response CSP nonce makes a 304 unsafe).
- `app/middleware/headers.ts` adds the security headers and the HTML
  Cache-Control default (`private, no-cache`; `no-store` under `/settings`,
  `/me`, `/login`, `/auth` and `/logout`). Set your own Cache-Control on a
  response that needs another policy.
- HTML gets a strict CSP (decision 027): `script-src 'nonce-…'
  'strict-dynamic'`, a fresh nonce per response. `Document` nonces the
  import map and the entry, and everything else must be imported by them
  (modules, islands). Never add an inline `<script>` or an `on*=`
  attribute: it won't run. A script tag you must render takes
  `nonce={cspNonce(handle)}` (`@bits/ui/csp-nonce`). Inline styles and
  `style=` are allowed. New image, font or connect origins go in
  `contentSecurityPolicy()`. Violations are logged as `CSP violation`
  (`POST /csp-report`). `pnpm dev` (HMR) only reports.
- Write endpoints get a burst limit: add
  `middleware: [rateLimit('RL_<tier>')]` to the action
  (`app/middleware/rate-limit.tsx`). Tiers are bindings in
  `wrangler.jsonc`; after adding one, run `pnpm cf-typegen`.
- Log with `log(level, message, fields)` from `app/log.ts` (JSON lines).
  Decision 039 rules:
  - `error` opens a Workers Issue, so keep it for things the owner should
    look at.
  - Log a request with `requestFields(request)` (method, path, `cf-ray`),
    never its URL: query strings carry tokens and email addresses.
    `errorFields()` redacts addresses.
  - `logServerErrors()` in `router.ts` already logs every 5xx once, so
    don't log the same failure again at the request level.
- Housekeeping (decision 039): when you add a table with rows that expire,
  add its delete to `deleteExpiredRows`
  (`packages/db/src/queries/housekeeping.ts`), the one batch the daily cron
  runs, and to its test.
- Web Analytics (decision 033): the nonced beacon renders only when the
  `WEB_ANALYTICS_TOKEN` var is set and the request has no `Sec-GPC: 1`.
  Keep the dashboard's automatic injection off; its copy has no nonce.
- Browser-only packages go in `BROWSER_ONLY` in `scripts/build.ts`, so
  they never reach the Worker bundle.
- three.js (decision 046): islands import it only through
  `app/actions/public/three.ts`; add a class there before using it. The
  build bundles that module tree-shaken; never `import('three')` directly.
- A `<link>` or `<script>` in `<head>` takes a `data-rmx-key` (decision
  046): client navigation pairs unkeyed head siblings by position and
  rewrites them in place.
- The Worker is code-split (decision 026): wrangler uploads `build/worker`
  as built (`no_bundle`), one module per chunk. Code that only some routes
  or actions need (the content compiler, the Anthropic SDK, the
  styleguide, the lesson page and its islands; decision 052) is loaded with
  `await import()` where it's used, so it
  stays out of startup. `pnpm build` prints the startup size; check it
  when you add a heavy dependency.

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
- Squared grid (decision 047): corners are 0 (`--radius-round` only for
  dots, rings and avatars), with no shadows, glows, blur or hover lifts.
  Depth is a hairline plus a fill step, and accents are signals. Lay
  pages out as `PageFrame` > `RuledSection` > `CellGrid`. The decision
  has the page-conversion checklist.
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
- Text inputs (decision 051): build on `@bits/ui/lib/field` (`fieldFrameStyle`,
  `fieldInputStyle`, `fieldMultiStyle`, `fieldFocus`, `--field-*` tokens): mono
  16px for anything typed to Claude or answered, never under 16px (iOS zooms),
  neutral hairline at rest, focus drawn on the frame. The styleguide's "Field"
  specimen shows every host.
- Links take `prefetch` and render `data-rmx-prefetch={prefetchFor(...)}`
  (`lib/prefetch.ts`, also `@bits/ui/lib/prefetch` for app code) after
  `aria-current`. Same-origin page links prefetch on intent; document,
  download, external, OAuth and side-effect links never do (decision 042).
  Borders use `--border-w`, focus uses `focusOutline`, control heights use
  `--control-*`; busy buttons use `busyStyle` from `lib/states.ts`.
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
| Document | document.tsx | assets, title, description, url (canonical + og:url), siteName, image (og:image; `summary_large_image`), head; nonces its scripts from `CspNonce` | static |
| CspNonce / cspNonce | csp-nonce.tsx | nonce (provider; the app's renderer wraps every page) / `cspNonce(handle)` reads it | static |
| AppBar | app-bar.tsx | brand, homeHref, links, currentPath, actions, variant, position, sub (second header row; `--appbar-h` tall, decision 022) | static |
| AppBarMenu | app-bar-menu.tsx | links, currentPath, label (mobile sheet <760px from `--appbar-h`, native popover) | island |
| Logo / BrandMark | logo.tsx / brand-mark.tsx | brand, href, variant, prefetch / size | static |
| NavLink | nav-link.tsx | href, variant, current, prefetch | static |
| Icon | icon.tsx | name (`iconNames`), size, color, label | static |
| Keycap | keycap.tsx | variant primary/dark/ghost/ghost-mono/inverse/ion, size sm/md/lg, href, document, download, type, loading, glow, block, disabled, prefetch (links; dropped with document/download/disabled) | static |
| PendingSubmit | pending-submit.tsx | label, pendingLabel, variant, size, block, grow, name, value | island |
| ToolButton | tool-button.tsx | variant outline/quiz/video, square, label, pressed (busy caret on aria-busy) | static |
| ProviderButton | provider-button.tsx | icon, href (always data-rmx-document, never prefetched) or type/name/value, busy (caret via busyStyle) | static |
| BackButton | back-button.tsx | href, label, prefetch | static |
| SegmentedTabs / StaticTabs | segmented-tabs.tsx | label, items, flavour mode/account / items, selected, size | static (URL tabs) |
| TabPanels | tab-panels.tsx | label, items {name, label, panel}, defaultTab, flavour | island (@remix-run/ui tabs) |
| ChoiceChip / Chip / SuggestionChip | chip.tsx | name, value, type, defaultChecked / selected / href, prefetch | static |
| FilterPill | filter-pill.tsx | href, dot, count, selected, prefetch, variant pill/cell (`cell`: a full-height cell of a ruled toolbar row) | static |
| Tag | tag.tsx | variant, color | static |
| TextField | text-field.tsx | name, label, type, value, error, hint, mono, compact (every variant 16px, decision 051), enterKeyHint, autoCapitalize, spellCheck | static |
| SearchField | search-field.tsx | action, name, value, label, shortcut, variant field/cell (`cell`: no box, fills its grid cell); built on the shared field mixins | static |
| SearchShortcut | search-shortcut.tsx | target (input id; `/` and Cmd/Ctrl-K focus it) | island |
| CodeInput | code-input.tsx | name, length, error, autoSubmit, autoFocus, value | island (one input without JS) |
| Switch | switch.tsx | name, legend, options, value | static (native radios) |
| QuizChoice | quiz-choice.tsx | name, question, options, multiple, explanation, action, formAction, label (header strip, default "quick check") | static (POST form) |
| AskPanel | ask-panel.tsx | id, question, placeholder, choices, multiple, xp, endpoint (`/api/ask`; absent in the preview), initial (flashed verdict), passed, label; a native form to `/api/ask` without JS, `bits:gate` + `bits:reward` on a right answer (decision 052) | island |
| PageFrame | page-frame.tsx | as div/main, id, rails (the centred column, `--frame-max` wide, `--section-gap` under its last plate; `rails` only for a sectionless workspace like the lesson page; decisions 047, 050) | static |
| RuledSection | ruled-section.tsx | as, id, aria-labelledby, index, label, labelAs p/h2/h3 + labelId (the strip label is the section's heading and labels it), aside, tone, pad default/tight/none, rule (off: joins the block above, no gap or top rule), marks (a framed plate: own rails, full-bleed rules above and below, `+` marks at the corners, `02 / label` strip; the strip draws the hairline under itself) | static |
| Panel / panelLinkStyle / panelListStyle | panel.tsx | id, title, level 2/3, aside, flush (a block inside a grid cell: the strip with a real heading, then a padded or flush body; stacked panels share a hairline) / aside link / flush list rows | static |
| CellGrid / cellLinkStyle | cell-grid.tsx | cols, colsMid, colsPhone, edge flush/boxed, fill none/ink, top (`false` right under a strip, which already draws that line), pad, as ul/ol/div (cells share 1px borders) / mixin for a whole-cell `<a>` | static |
| Crosshair | crosshair.tsx | placement top-start/top-end/bottom-start/bottom-end (the `+` where a rule meets a rail) | static |
| Card | card.tsx | variant default/page/compact/dashed/glass, as, label | static |
| Callout | callout.tsx | tone ok/warning/danger/info, role, title, compact | static |
| Eyebrow / MonoHeading | eyebrow.tsx | tone, size, as / level, id | static |
| Kbd | kbd.tsx | decorative | static |
| StatTile | stat-tile.tsx | value, label, color, variant main/profile (flat, borderless: a `CellGrid` cell) | static |
| KeyValueList | key-value-list.tsx | items, variant default/course | static |
| EmptyState | empty-state.tsx | title, hint, action, variant boxed/bare (`boxed`: flat hairline box with a mono `∅`; `bare`: no box, for a state that fills a cell or band) | static |
| LiveDot | live-dot.tsx | tone, pulse | static |
| Footer | footer.tsx | brand, homeHref, links, copyright | static |
| XpPill / StreakPill / AvatarButton | xp-pill.tsx / streak-pill.tsx / avatar-button.tsx | neurons / days / initials, href, current, prefetch | static |
| CourseCover / Sigil | course-cover.tsx | pattern (8 `coverPatterns`), tone volt/ion/synapse, sigil, variant card/banner/art/thumb | static |
| CourseCard / WriteCourseCard | course-card.tsx | href, title, desc, level, lessons, mins, sigil, tone, pattern, formats, pct, prefetch, variant card/cell (`cell`: a whole-cell link in a `CellGrid`, built on `cellLinkStyle`) | static |
| ContinueBanner | continue-banner.tsx | href, courseTitle, eyebrow, nextLesson, mins, pct, sigil, tone, pattern, prefetch, edge boxed/flush (`flush`: fills a ruled band rail to rail) | static |
| ProgressBar / SegmentedProgress | progress-bar.tsx | pct, variant card/banner/art/row/level, color, label / segments | static |
| ProgressRing | progress-ring.tsx | pct, size 96/132, color, caption, label | static |
| LessonNode / LessonNodeRow | lesson-node.tsx | state done/current/next, size, n, passed / state, badge | static |
| LessonBar / LessonModes | lesson-bar.tsx | backHref, context, title, titleAs, segments, modes, neurons, xp, position shell/sticky/static (`shell` = AppBar `sub`; two-line title, 3px progress strip on phones) / modes, aside (the <760px chrome row; `aside` holds the outline disclosure), mix | static |
| TutorAvatar / TutorMessage / LearnerBubble / ModelOutput | tutor.tsx | size / variant / variant / temperature, tokens, state done/streaming/example/error, note | static |
| CheckChip | check-chip.tsx | passed, compact | static |
| TokenPill / TokenizerPanel | token-pill.tsx | text, id, index / tokens, illustrative | static |
| HexBadge / BadgeTile / BadgeChip | hex-badge.tsx | name, glyph, color, variant earned/locked/preview/chip (BadgeTile is a grid cell: `CellGrid as="ul" pad={false}`, or `badgeGridStyle`) | static |
| ActivityGrid | activity-grid.tsx | levels (`sampleActivity()` for demos), label, heading, headingLevel, titles (per-cell hover), end (month names), caption, variant card/bare (`bare`: no box or heading, inside a `Panel`; square cells sized 7–24px to fill the width) | static |
| RewardToast | reward-toast.tsx | xp, message, title, badge {name, glyph, color}, next, variant lesson/system | static |
| RewardRegion | reward-toast.tsx | dismissAfter, initial (server-decided reward, in the HTML); shows toasts from `announceReward()` (`bits:reward`) as a fixed overlay at the viewport's bottom (`--z-toast`, `--toast-width`), never in the flow | island |
| OddsBars | odds-bars.tsx | context, candidates, defaultValue (follows `bits:temperature`) | island |
| OddsList | odds-list.tsx | rows {token, p, picked}, label, top (`formatOdds`, `showToken`) | static |
| ToyPanel / IllustrativeTag | toy-panel.tsx | context, label, illustrative, name | static |
| NextTokenPlayer | next-token.tsx | prompt, steps {token, p, alternatives}, illustrative (`:::nexttoken`) | island (fallback: sentence + steps table) |
| TrainingScrubber | training-scrubber.tsx | id, prompt, snapshots {step, loss, text}, illustrative (`:::training`) | island (fallback: snapshot list) |
| AttentionMap | attention-map.tsx | tokens, links {from, to, weight}, caption, illustrative (`:::attention`) | island (fallback: from → to table) |
| ComparePanel | compare-panel.tsx | left, right, rows {prompt?, left, right}, illustrative (`:::compare`) | static |
| RabbitHole | rabbit-hole.tsx | links {kind video/read, title, by, url, mins, deep}, id (`:::rabbithole`) | static |
| PromptComposer | prompt-composer.tsx | id, task, checks, temperatures, examples, reward, keepRuns, submit, run (/api/run); runs fill a fixed window (`--run-log-height`) that follows the newest reply; compact (`--run-log-empty-height`) until the first run, which grows it once and scrolls so the composer stays put | island (Enter runs, Shift+Enter newline) |
| CodeEditor | code-editor.tsx | files, highlight, focusLine, typeMode, persist, flush (no outer border inside a ruled cell) | island (@remix-run/ui tabs) |
| TerminalLog | terminal.tsx | path, entries, replies, placeholder, flush (no outer border inside a ruled cell); a Run/Send Keycap inside the field frame; fixed height (`--terminal-height`, capped below the header; all the room under it on phones), log scrolls inside | island |
| TerminalOutput | terminal.tsx | lines | static |
| OutputPanel | terminal.tsx | command, lines (replayed), flush; a Ghost holds the full size, scrolls past `--output-panel-height` | island |
| VideoPlayer | video-player.tsx | title, duration, chapters, cues, transcriptOpen, source {src} (plain `<video>`, MP4), initialTime, persist (position) | island (simulated clock without `source`) |
Helpers (decision 023): `lib/stable.tsx` has `createFollower()` (a `ref`
mixin that keeps a fixed-height scroll window at the bottom while the reader
is there; pair it with `scrollWindowStyle`) and `stackStyle` + `<Ghost>`
(stack an island's states in one grid cell; invisible copies of the larger
states reserve their size). A box that fills with data gets a fixed height
from a token and scrolls inside; a toy whose content changes ghosts its
larger states. Measure with a `layout-shift` PerformanceObserver.
`lib/states.ts` has the forced hover/focus/active selectors and
`forcedSelected` (decision 024), plus the forced-colours helpers
`forcedFill`, `forcedInlineFill`, `forcedTrack`, `forcedMark` and
`forcedSvgPaint` (decision 025). A state drawn only with a background
vanishes in forced colours: give it a system-colour rule in the same
`css()` mixin as the colours it overrides (each mixin is its own layer, so a
base-mixin rule loses to a variant's). Check with Playwright
`page.emulateMedia({ forcedColors: 'active' })` in dark and light.

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
- Round trips (decision 026): every response that touched D1 carries
  `Server-Timing: db;dur=…;desc="N queries, M round trips"` (dev and
  production; `curl -I` shows it). Run independent reads in parallel or in
  one `db.batch`, never as sequential awaits. The session read already
  brings the user (`readSessionWithUser`) and, on `GET /courses…`, the
  completed lessons, so a signed-in lesson page is one round trip.
  A response that resolved the catalog adds `catalog;dur=…;desc="memo|stale|cold"` and, if it read R2, `r2;dur=…;desc="N reads"`.
- Several reads about one user or course go in one `db.batch`, keyed by a
  subquery (decision 035): `queries/profile.ts` (`UserRef`) for `/me`,
  `/u/:handle` and certificates, and `readAuthorCourses` for `/author`. A
  page whose reads are known from its URL can join the session batch, as
  `/me` does (`loadSession({ withProfile })`, `profileLoadedWith`). Pin a
  page's count with a `Server-Timing` assertion in its controller test.

## Auth (decision 015)

- Who is signed in: `currentUser(context)` / `getViewer(context)` from
  `app/auth/identity.ts`. Protect a controller with
  `middleware: [requireUser()]`; then `context.auth.identity` is the user.
- Session data: `context.session` (`remix/session`, stored in D1). Sign in
  only through `startUserSession`, which rotates the id. Sign out with
  `context.session.destroy()`.
- Step-up (decision 030): anything that adds a way into the account
  (changing the email, adding a passkey, linking GitHub/Google while
  signed in) needs `recentlyAuthenticated(context)`, checked on the
  server at every step that writes. Otherwise send the user to
  `/settings?saved=reauth&for=…`. A completed email change signs out the
  other sessions. A revert ends every session and drops passkeys and
  identities added since the day before the change.
- CSRF is `remix/middleware/cop` in `router.ts`. Plain same-origin form
  POSTs just work. Do not add token fields.
- Mail: `sendMail` from `app/auth/mailer.ts`. Outside production it lands
  in `outbox` (dev also logs `[mail]` with the code).
- Mail cap (decision 039): any email someone can ask for first takes a
  slot with `reserveMail(db, purpose)` (`app/auth/mail-quota.ts`), after
  the per-address and per-IP checks pass. It's one atomic upsert on
  `mail_quota`, capped by `SIGNIN_MAIL_DAILY_CAP`. If it's refused, answer
  `rate-global` (a 429 that offers passkeys, GitHub and Google).
- Tests: sign in with `signIn(email, { role })` and request with
  `fetchAs(cookie, path)`. `remix test` runs `after` around every
  `describe`, so a file that touches D1 keeps **one flat describe** with
  `after(() => disposePlatform())` inside it.
- Secrets: `SESSION_SECRET` (required in production),
  `GITHUB_CLIENT_ID/SECRET` and
  `GOOGLE_CLIENT_ID/SECRET`. See `apps/web/.dev.vars.example`.
- Passkeys (decision 030): `app/auth/passkeys.ts` (`@simplewebauthn/server`,
  Web Crypto only). Options come from `/api/passkey/*-options` as JSON, and
  the response goes back in a native form POST. Challenges are single-use
  D1 rows (`webauthn_challenges`, 10 min). The RP is `CANONICAL_ORIGIN` in
  production, else the request's Origin (use `localhost`, never an IP).
- Sensitive changes (email, adding a passkey) need `recentlyAuthenticated`
  (10 min); otherwise render `ReauthBlock` (code to the current address or
  a passkey). Email change (`app/auth/email-change.ts`) uses
  purpose-tagged `email_tokens`. Links never start a session. The old
  address gets a 7-day revert link, and while one is open, further changes
  are refused. Sign-in queries must filter `purpose = 'sign-in'`.
- Roles (decision 037): `learner`, `author`, `admin` on `users.role`.
  Admin pages take `middleware: [requireUser(), requireAdmin()]`
  (`app/auth/require-admin.tsx`), and admin writes re-check the role in
  their SQL (`packages/db/src/queries/authors.ts`). Admins make authors
  at `/admin/authors`: an emailed invite (`author_invites`, hashed token,
  7 days, single use, under the mail cap) accepted at `/admin/invite` by
  a session signed in as that address; accepting never downgrades an
  admin. Roles step down one at a time, never your own. Making an admin
  is still a manual D1 change.
- Passkey tests: `createSoftAuthenticator()` (`app/test/webauthn.ts`),
  `ageSessions(userId)` to make a session stale. E2E uses a CDP virtual
  authenticator on `localhost` (`app/passkeys.test.e2e.ts`).

## Progress (decision 016)

- The catalog carries content only. Pass the viewer's completed lessons,
  `await loadCompleted(context)`, to `catalog.getCourse`, `listCourses`,
  `getLesson` or `getContinue` to get states and pct.
- Saving is the native form `POST /courses/:course/:lesson/complete`.
  Exercises join it via `form=` hidden fields (`fieldNames` in
  `lesson/ui/exercise.ts`). The server re-runs the checks
  (`progress/check.ts`). Never read XP from the client.
- Signed in, progress goes to D1 in one batch (`recordLessonCompletion`).
  Signed out, it goes to the session (`progress` key), and
  `startUserSession` merges it at sign-in.
- Tests: `completeLesson(cookie, course, lesson, fields)` in
  `app/test/auth.ts`.

## Policies, previews, badges, certificates (decision 028)

- `/terms` and `/privacy` (`app/actions/legal/`) describe what the code
  does. Change them (and their `*_UPDATED` date) with any change to what's
  stored, who receives it, retention, export or delete.
- Link previews: pass `image={ogImage('course-<slug>', alt)}` to `Layout`
  (`app/ui/og.ts`); without it a page gets the landing card. After adding a
  course or changing its title, cover or badge, run `pnpm og` and commit.
- Badge toast: the complete action flashes new badges
  (`flashReward`); a page a completion can land on passes
  `reward={takeReward(context)}` to `Layout`. Never raise one from the client.
- Certificates (`/u/:handle/certificates/:course`) are derived from
  `lesson_progress` and follow profile visibility; never add the email or
  journal to them.

## Content (decision 018)

- Courses are markdown folders in `content/courses/<slug>/`, not code.
  Frontmatter and block syntax: the `.md` files there and the block
  reference on `/author`. Change content, then `pnpm content validate`.
- Lesson toys (decision 021): `:::nexttoken`, `:::training`,
  `:::attention`, `:::compare` and `:::rabbithole`. Bodies are plain lines;
  the exact syntax is in the decision and on `/author`. Mark made-up
  numbers with a bare `illustrative` attribute (or `illustrative: true` in
  the lesson frontmatter); rabbit holes take `https` links only, 3 at most.
  A toy island renders its no-JS fallback on the server and switches to
  the interactive view on the client. Valid and broken examples:
  `content/fixtures/toys/` and `content/fixtures/broken-toys/`.
- Quick checks (decision 052): `:::ask` (and `:::quiz`, which builds into
  one) is graded only by `POST /api/ask` and journalled in `ask_attempts`;
  the save reads right answers from the journal, never form fields, and
  patterns and right choices never reach the browser. Tests answer with
  `answerAsk(cookie, course, lesson, ask, answer)`.
- Read published content with `const catalog = await getCatalog(context)`
  (`app/content/request.ts`), then
  `catalog.getCourse/listCourses/getLesson/getContinue` and
  `await catalog.lessonContent(course, lesson)`. An isolate memo serves it
  (5 s fresh, then stale while one background refresh runs; only an empty
  memo waits; decision 026). A cold isolate reads the colo cache
  (`platform.sharedCache`, the Workers Cache API, a no-op on Node), else the
  one R2 object `catalog/live.json`: no D1 (decision 054). Change the live
  pointer only through `publishVersion(db, bucket, slug, n, { cache })`,
  which rewrites that object (compare-and-swap on its etag), purges this
  colo's copy and drops the memo; a publish elsewhere lands within about a
  minute. Never read R2 directly in a page; `store.ts` memoises immutable
  versions per isolate. Its cost is metered per request (`content/meter.ts`)
  into the `catalog` (`memo`, `stale`, `cache`, `cold`, `rebuild`) and `r2`
  Server-Timing entries; pass a meter down, never keep request state in
  `store.ts`.
- The build (`app/content/compile/`) is pure and runs in the CLI, tests and
  the Worker. Errors are `report.error(text, line)` with a source line;
  add a case to `compile/build.test.ts` for each new check. (The folder
  isn't `build/`: `.gitignore` drops every `build/` directory.)
- Publishing only flips `courses.current_version_id` to a `ready`
  version. Builds with errors are recorded as `failed` (report only).
- Master pushes publish `content/courses/` to production (decision 036).
  `saveBuild` stamps each manifest in R2 with a hash of the build's output
  (`build-sha256`), and `uploadCourseFolder` skips a course whose build
  matches its newest version, so linked videos count as a change. A
  rollback on `/author` stands until the course changes. CI uploads as no
  user (trusted CLI, owner and authors untouched); `source` is
  `ci <sha> (remote)`.
- Authored content runs on the server, so the build guards it: check
  regexes must fit the allowlist grammar in `compile/regex.ts` (literals,
  `.`, `\b \w \d \s` and their negations, escaped symbols, simple
  classes, `|`, `(...)` / `(?:...)`, `^ $`, and at most 4 `?`; no `*`, `+`
  or `{n}` at all, and at most 64 paths). Extend the grammar there, never
  with a denylist; `progress/check.ts` re-validates stored patterns before
  running them. Xp stays within
  `app/content/limits.ts` (100 per block, 500 per lesson; `check.ts`
  clamps again). Ownership is claimed atomically in `recordCourseBuild`;
  don't add read-then-write ownership checks around it.
- Lesson prose links: `[text](/courses/...)` or `https` only (anything
  else is a build error). Prompt `draft`/`placeholder`/`example` strings
  take `\n` for line breaks.
- Tests: the test platform uploads and publishes every folder in
  `content/courses/` at startup, so a broken course fails every test run.
  It also publishes `content/fixtures/plain-course/` (tests only): tests
  that need ungated lessons use it (`app/test/plain-course.ts`), never a
  real course's lessons.

## Live prompts (decision 019)

- `POST /api/run` (FormData: course, lesson, exercise, prompt,
  temperature × 100) streams plain text. `X-Run-Source` is `live`,
  `example` or `fallback`; `X-Run-Reason` says why a fallback happened.
  Limits are enforced by the insert (`insertRunWithin`): reserve the row,
  then call the model. Never count first and insert later.
  The islands call it through `packages/ui/src/lib/run-stream.ts` when they
  get a `run` prop (`exerciseProps` sets it); a rerun aborts the one in
  flight.
- Only `app/runs/model.ts` talks to a provider (Claude Haiku 5.5 through
  AI Gateway, `@anthropic-ai/sdk`). It owns `runModel`, `ModelError` and
  `liveTemperatures` (only T=1.0 is live: the API takes no sampling
  parameters). Don't import the SDK anywhere else, and don't hard-code
  which temperatures are live.
- `app/runs/run.ts` does the limits, the journal and the fallback. Every
  run is an `exercise_attempts` row (`packages/db/src/queries/runs.ts`);
  signed-out runs carry the session's `visitor` id and move to the user
  at sign-in. Limits live in `runLimits`; the daily live cap is the
  `RUN_DAILY_LIVE_CAP` var.
- "Ran at 0 and 1.0" is checked against journalled runs, never form
  fields. Tests: `runAt(cookie, exercise, [0, 100])` or
  `runPrompt(cookie, input)` from `app/test/auth.ts`. Without
  `CF_AIG_TOKEN` or `ANTHROPIC_API_KEY`, runs fall back to the examples.
  Tests always run without them, whatever `.dev.vars` holds; live tests
  stub `globalThis.fetch` for the gateway URL (`app/runs/run.test.ts`).
- Keys: gateway BYOK. The Anthropic key lives in the AI Gateway, and the
  Worker's secret is `CF_AIG_TOKEN`. Never send a provider key from the
  Worker: it would override the stored one. `ANTHROPIC_API_KEY` is optional
  and for local use only. Vars: `AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_ID`,
  `RUN_DAILY_LIVE_CAP`.

## Video and drafts (decision 029)

- Video is R2-only (owner's call, 2026-10-27; no Stream, no hls.js).
  MP4s live in `CONTENT` under `videos/<uuid>.mp4`, uploaded in 10 MiB
  parts through the Worker (`POST /api/author/videos`, `PUT
  …/:id/parts/:n`, `POST …/:id/complete`) by the `VideoUpload` island on
  `/author/:course`. The Worker marks the `videos` row ready itself; there
  is no webhook. `GET /media/videos/:id.mp4` serves them with Range and
  immutable caching, and refuses cross-site requests. It is answered by
  the `serveMedia()` router middleware, right after `responseHeaders()`,
  so it never reads the session or D1 (decision 035). A public, immutable,
  non-HTML response that needs neither belongs there too, not after
  `loadSession`.
- Builds link a lesson's `video:` path to the newest ready upload:
  callers pass `buildCourse(files, { videos: await loadVideoLinks(db) })`.
  No ready upload → a warning, no `content.video`, text-only. Check with
  `hasVideo(content)`, never `content.video`. After uploading a video,
  rebuild the course to link it.
- Islands keep drafts with `persist` (`@bits/ui/lib/drafts`):
  localStorage first, then (signed in) a debounced, batched
  `POST /api/drafts` into `lesson_drafts`. Build it with
  `draftPersist(view, draftKey.x(...))` from `lesson/ui/exercise.ts`. Keys
  are `prompt:<exercise>`, `code:<file>` and `video`; the endpoint only
  accepts keys from `lessonDraftKeys(content)`. Modules the content build
  imports (like `exercise.ts`) must not import `#platform`, even
  indirectly: the test platform builds content while `#platform` loads,
  and the cycle hangs every test run. Use `progress/draft-keys.ts` and
  `video/keys.ts`, which are pure.
- Tests: `app/test/videos.ts` seeds a ready video for the Temperature
  lesson, so it has Watch mode.

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
