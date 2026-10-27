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
pnpm deploy               # build, then wrangler deploy → https://bits.yogan.dev (workers.dev 301s there)
pnpm db:migrate:local     # wrangler d1 migrations apply (local state shared by dev and preview)
pnpm db:migrate:remote
pnpm db:seed:local        # demo user demo@bits.local / @demo, then upload + publish content/courses/*
pnpm content validate <dir…>            # build course folders, print path:line problems
pnpm content upload <dir…> [--publish]  # save as the next version (local; --remote for deployed)
pnpm og                   # screenshot /cards/* into apps/web/public/og/*.png + app/ui/og-cards.generated.ts (commit both)
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
- Web Analytics (decision 033): the nonced beacon renders only when the
  `WEB_ANALYTICS_TOKEN` var is set and the request has no `Sec-GPC: 1`.
  Keep the dashboard's automatic injection off; its copy has no nonce.
- Browser-only packages go in `BROWSER_ONLY` in `scripts/build.ts`, so
  they never reach the Worker bundle.
- The Worker is code-split (decision 026): wrangler uploads `build/worker`
  as built (`no_bundle`), one module per chunk. Code that only a rare route
  or action needs (the content compiler, the Anthropic SDK, the
  styleguide) is loaded with `await import()` where it's used, so it
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
| Document | document.tsx | assets, title, description, url (canonical + og:url), siteName, image (og:image; `summary_large_image`), head; nonces its scripts from `CspNonce` | static |
| CspNonce / cspNonce | csp-nonce.tsx | nonce (provider; the app's renderer wraps every page) / `cspNonce(handle)` reads it | static |
| AppBar | app-bar.tsx | brand, homeHref, links, currentPath, actions, variant, position, sub (second header row; `--appbar-h` tall, decision 022) | static |
| AppBarMenu | app-bar-menu.tsx | links, currentPath, label (mobile sheet <760px from `--appbar-h`, native popover) | island |
| Logo / BrandMark | logo.tsx / brand-mark.tsx | brand, href, variant / size | static |
| NavLink | nav-link.tsx | href, variant, current | static |
| Icon | icon.tsx | name (`iconNames`), size, color, label | static |
| Keycap | keycap.tsx | variant primary/dark/ghost/ghost-mono/inverse/ion, size sm/md/lg, href, document, download, type, loading, glow, block, disabled | static |
| PendingSubmit | pending-submit.tsx | label, pendingLabel, variant, size, block, grow, name, value | island |
| ToolButton | tool-button.tsx | variant outline/quiz/video, square, label, pressed | static |
| ProviderButton | provider-button.tsx | icon, href (always data-rmx-document) or type/name/value, busy | static |
| BackButton | back-button.tsx | href, label | static |
| SegmentedTabs / StaticTabs | segmented-tabs.tsx | label, items, flavour mode/account / items, selected, size | static (URL tabs) |
| TabPanels | tab-panels.tsx | label, items {name, label, panel}, defaultTab, flavour | island (@remix-run/ui tabs) |
| ChoiceChip / Chip / SuggestionChip | chip.tsx | name, value, type, defaultChecked / selected / href | static |
| FilterPill | filter-pill.tsx | href, dot, count, selected | static |
| Tag | tag.tsx | variant, color | static |
| TextField | text-field.tsx | name, label, type, value, error, hint, mono, compact, enterKeyHint, autoCapitalize, spellCheck | static |
| SearchField | search-field.tsx | action, name, value, label, shortcut | static |
| SearchShortcut | search-shortcut.tsx | target (input id; `/` and Cmd/Ctrl-K focus it) | island |
| CodeInput | code-input.tsx | name, length, error, autoSubmit, autoFocus, value | island (one input without JS) |
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
| LessonBar / LessonModes | lesson-bar.tsx | backHref, context, title, titleAs, segments, modes, neurons, xp, position shell/sticky/static (`shell` = AppBar `sub`) / segments, modes (<760px row) | static |
| TutorAvatar / TutorMessage / LearnerBubble / ModelOutput | tutor.tsx | size / variant / variant / temperature, tokens, state done/streaming/example/error, note | static |
| CheckChip | check-chip.tsx | passed, compact | static |
| TokenPill / TokenizerPanel | token-pill.tsx | text, id, index / tokens, illustrative | static |
| HexBadge / BadgeTile / BadgeChip | hex-badge.tsx | name, glyph, color, variant earned/locked/preview/chip | static |
| ActivityGrid | activity-grid.tsx | levels (`sampleActivity()` for demos), label | static |
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
| CodeEditor | code-editor.tsx | files, highlight, focusLine, typeMode | island (@remix-run/ui tabs) |
| TerminalLog | terminal.tsx | path, entries, replies, placeholder; fixed height (`--terminal-height`, capped below the header; all the room under it on phones), log scrolls inside | island |
| TerminalOutput | terminal.tsx | lines | static |
| OutputPanel | terminal.tsx | command, lines (replayed); a Ghost holds the full size, scrolls past `--output-panel-height` | island |
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
- Read published content with `const catalog = await getCatalog(context)`
  (`app/content/request.ts`; an isolate memo, stale-while-revalidate, 5 s
  fresh and 60 s at most, so usually no D1 query; change the live pointer
  only through `publishVersion`, which drops the memo; decision 026), then
  `catalog.getCourse/listCourses/getLesson/getContinue` and
  `await catalog.lessonContent(course, lesson)`. Never read R2 directly in
  a page; `store.ts` memoises immutable versions per isolate.
- The build (`app/content/compile/`) is pure and runs in the CLI, tests and
  the Worker. Errors are `report.error(text, line)` with a source line;
  add a case to `compile/build.test.ts` for each new check. (The folder
  isn't `build/`: `.gitignore` drops every `build/` directory.)
- Publishing only flips `courses.current_version_id` to a `ready`
  version. Builds with errors are recorded as `failed` (report only).
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
- Tests: the test platform uploads and publishes every folder in
  `content/courses/` at startup, so a broken course fails every test run.

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
  immutable caching, and refuses cross-site requests.
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
