# Audit lane E: Remix 3 best practices (code review, read-only)

Scope: `apps/web/app` (routes, router, controllers, middleware, forms and schemas, islands, client
navigation, errors, headers, sessions, data access) and `packages/ui`. I checked it against the
installed `remix@3.1` docs (`apps/web/node_modules/remix/guides/*`, `src/*/README.md`) and AGENTS.md.
I didn't need a browser. Each finding cites a doc or rule.

## Tool results

- `pnpm remix:doctor`: **clean**. Environment, project and actions all pass ("Doctor found no
  issues. 0 warnings, 0 advice").
- `pnpm typecheck`: **clean** (packages/db, packages/ui, apps/web: `tsc --noEmit`, exit 0).

## Overall

The app follows the documented idioms well:

- **Routing:** one `route()` map, per-area controllers, `router.map` per nested map and a typed
  `AppContext` augmentation (guide 03).
- **Middleware:** `remix/middleware/auth` with `createSessionAuthScheme` and `requireAuth`;
  `remix/session` with a D1 storage; `cop`; `render({ onError })`.
- **Browser runtime:** `run()` with a custom `resolveFrame` (guide 12) and frame
  `reloadStart`/`reloadComplete` for pending UI (guide 09).
- **Forms:** `remix/data-schema/form-data` schemas in `schema.ts`.
- **Links and keys:** `href()` almost everywhere, and `data-rmx-key` on every head
  link/script/meta (decision 046).
- **Fast paths:** `createMatcher(routes.x.pattern)` for the media, robots and sitemap
  middleware.

I found no React, Remix v2 or React Router patterns. The findings below are deviations, not a
broken architecture.

---

### [P1] Author "Sync a repo" card fakes a connected repo and a successful save

- **Page/flow:** `/author` (author/admin), any breakpoint or theme.
- **What's wrong:**
  - `RepoSyncCard` is fed a hard-coded constant,
    `export const repo = { name: 'jamie-park/courses', branch: 'main', connected: true }`. It
    shows a green "connected" dot for a repo nobody connected.
  - The `POST /author/repo` action is a stub. It reads no fields and saves nothing, then
    redirects to `?repo=saved`, and the card announces "Saved. The next push to main rebuilds
    your courses."
  - `POST /webhooks/github` returns 501, so no push rebuilds anything.
- **Why it matters:**
  - AGENTS.md "Honest: … never fake a live result".
  - Guide 09 "Forms and Mutations": an action parses with a schema, re-renders failures and
    redirects only after it saves.
  - An author who trusts the card will wait for a sync that never comes.
- **Proposed fix:** Remove `RepoSyncCard`, the `author.repo` route and action, and the
  `repoSaved` prop until the GitHub milestone lands. Or show it disabled, "coming soon", with
  no form. Change the empty-state hint "Drop a folder above or connect a repo." to match.
- **Files:**
  - `apps/web/app/actions/author/data.ts:80`
  - `apps/web/app/actions/author/controller.tsx:31,35-39`
  - `apps/web/app/actions/author/ui/repo-sync-card.tsx:22-55`
  - `apps/web/app/actions/author/author-page.tsx:65,86`
  - `apps/web/app/routes.ts:91` (`repo: post('/repo')`)
- **Shared?** No (author area only). Removing the route also touches `routes.ts`.

### [P2] Unknown non-GET URLs answer a bare `405`, not the app's 404

- **Page/flow:** any `POST`/`PUT` to a path with no route, e.g. a stale form action.
- **What's wrong:**
  - The catch-all is `notFound: get('/*path')` (`routes.ts:163`).
  - The router doc says that when a URL matches only routes of other methods, "the router
    responds with `405 Method Not Allowed` and an `Allow` header". I reproduced it with the
    installed router: `POST /nope` → `405`, `Allow: GET, HEAD`, plain text, no `Layout`.
- **Why it matters:**
  - `src/fetch-router/README.md` "Method Not Allowed Responses".
  - Guide 02: "a route can also be defined with just a string … matches any request method".
  - Guide 12 "Render useful not-found responses".
- **Proposed fix:** Make the catch-all `notFound: '/*path'` (ANY), so every method gets the
  styled 404. The action already ignores the method.
- **Files:** `apps/web/app/routes.ts:163`, `apps/web/app/actions/controller.tsx:54-58`.
- **Shared?** Root route map only.

### [P2] Path regexes in `router.ts` and `headers.ts` duplicate the route contract

- **What's wrong:**
  - `loadSession({ withCompleted, withDrafts, withProfile })` decides by regex on
    `context.url.pathname`: `/^\/courses(?:\/|$)/`, `/^\/courses\/([^/]+)\/([^/]+)\/?$/` with
    manual `decodeURIComponent`, and `/^\/me\/?$/`.
  - `NO_STORE_PATHS = /^\/(?:settings|me|login|auth|logout)(?:\/|$)/` does the same in
    `headers.ts`.
  - The app already uses the documented matcher for the same job in `middleware/media.ts` and
    `middleware/site-files.ts`.
  - Renaming a pattern in `routes.ts` would silently break the one-round-trip lesson read
    (decision 026) and the no-store policy.
- **Why it matters:**
  - `routes.ts` header: "never hand-write paths".
  - Guide 02: "URL changes are not hidden in string literals around the app".
  - `src/route-pattern/README.md` "Match against a single pattern" (`createMatcher` returns
    decoded, typed `params`).
- **Proposed fix:**
  - Use `const lessonPage = createMatcher(routes.courses.lesson.index.pattern)`, then
    `lessonPage.match(context.url)?.params`. That drops the hand-decoding.
  - Do the same for `routes.me.index`.
  - Use a `createMultiMatcher` over `routes.settings`, `routes.me`, `routes.login`,
    `routes.auth` and `routes.logout` patterns (or their `route()` prefixes) for no-store.
- **Files:** `apps/web/app/router.ts:76-89`, `apps/web/app/middleware/headers.ts:66`.
- **Shared?** `router.ts` and `headers.ts` affect every request. Cover them with the existing
  Server-Timing and header tests.

### [P2] Settings and admin report validation failures through a redirect, and success through a sticky `?saved=`

- **Page/flow:** `/settings` (Appearance, Sign-in methods, passkey rename) and
  `/admin/authors`.
- **What's wrong:**
  - Some invalid submissions answer `303 → /settings?saved=appearance-error`, `methods-error` or
    `passkey-name` instead of re-rendering with `parsed.issues`.
  - Every success message lives in the query string. It comes back on reload, back/forward and
    bookmarks, and leaves "Passkey removed." in the URL.
  - Other parts of the app already use session flash (`flashReward`, the ask verdict, the
    preview code).
- **Why it matters:**
  - AGENTS.md "Adding a page" step 5: "re-render 422 with `parsed.issues` on failure, and
    redirect 303 on success".
  - Guide 09: "Redirecting back to the GET action would … lose the user's changes and errors",
    and "session flash data can carry that message across the redirect".
- **Proposed fix:**
  - Re-render `SettingsPage` with a 422 for the `*-error` and `passkey-name` cases. The
    `invalid()` helper already does this for profile and email.
  - Move the `saved` notice to `context.session.flash('notice', …)` and keep only the `#anchor`
    in the redirect.
  - Keep `?saved=reauth&for=` if decision 030 relies on it.
- **Files:**
  - `apps/web/app/actions/settings/controller.tsx:158-160, 244-280, 377-461`
  - `apps/web/app/actions/admin/authors/controller.tsx:141`
  - `apps/web/app/actions/auth/oauth/controller.tsx:14,20`
  - `apps/web/app/actions/auth/email/controller.tsx:13`
- **Shared?** Settings, admin and the auth callbacks. Settings e2e and controller tests assert
  on `?saved=`.

### [P2] Write endpoints without a burst limit

- **What's wrong:** These POSTs have no `rateLimit(...)`:
  - `settings.profile`: writes `users` and probes handle uniqueness, so it can enumerate
    handles.
  - `settings.sessions` and `settings.deleteAccount`.
  - `author.course.publish` and `rollback`: each rewrites the R2 `catalog/live.json` and purges
    the cache.
  - `author.repo` and `logout`.
- **Why it matters:** AGENTS.md "Responses": "Write endpoints get a burst limit: add
  `middleware: [rateLimit('RL_<tier>')]` to the action".
- **Proposed fix:** Add `middleware: [rateLimit('RL_WRITES')]` to those actions (object form,
  guide 02 "Controllers and actions").
- **Files:**
  - `apps/web/app/actions/settings/controller.tsx:129` (profile), plus the sessions and
    deleteAccount actions (~300-320)
  - `apps/web/app/actions/author/course/controller.tsx:43,62`
  - `apps/web/app/actions/logout/controller.tsx`
- **Shared?** No.

### [P2] `CatalogBackground` keeps the setup-time `courses`, so a track change can replay a stale graph

- **Page/flow:** `/courses`, switching a track pill or typing a search (client navigation).
- **What's wrong:**
  - `let courses = handle.props.courses` is read once in setup.
  - The ref that draws (`start(canvas, courses, signal)`) runs again when the keyed inner `<div
    data-rmx-key={replayKey}>` remounts on a track change.
  - AGENTS.md says islands keep their setup state when the next page renders them in the same
    spot, so the replay can draw the *previous* result set. I inferred this from the code and
    the docs; I didn't confirm it in the browser.
- **Why it matters:**
  - `.agents/skills/remix/SKILL.md`: "Read changing props from `handle.props` during render,
    rather than capturing their initial values in setup."
  - Guide 04 "Props, local state, context, and updates".
- **Proposed fix:** Read `handle.props.courses` inside the ref callback, which runs at render or
  commit, or put the `data-rmx-key` on an element that wraps the island so the whole island
  remounts.
- **Files:** `apps/web/app/actions/courses/public/catalog-bg.tsx:34-49`,
  `apps/web/app/actions/courses/catalog-page.tsx:73-76`.
- **Shared?** No.

### [P2] Hand-written URLs that should be `routes.x.href()`

- `apps/web/app/actions/author/course/course-build-page.tsx:32` and
  `apps/web/app/actions/author/course/controller.tsx:132` use `currentPath="/author"`. Use
  `routes.author.index.href()`.
- `apps/web/app/actions/styleguide/catalogue.tsx:461` uses `<form method="get"
  action="/styleguide">`. Use `routes.styleguide.index.href()`.
- `apps/web/app/actions/site-files.ts:14` has
  `DISALLOW = ['/settings', '/me', '/auth', '/api', '/author', '/admin']`. Derive these from the
  route maps, e.g. `routes.settings.index.href()`; `routes.auth` has no prefix map, so keep that
  one literal or add a `route('/auth', …)`.
- **Why it matters:** `routes.ts` header ("Build every URL with `routes.<name>.href(...)`;
  never hand-write paths") and guide 02.
- **Shared?** No.

### [P2] Raw D1 SQL and `getDatabase()` in places where the docs' and AGENTS' idioms apply

- `apps/web/app/progress/progress.ts:206` runs `db.d1.prepare('select badge_id from user_badges
  where user_id = ?')` inline.
  - AGENTS.md "Data": "Typed query helpers go in `src/queries/<area>.ts` and take the `Database`
    as their first argument".
  - Guide 08 "Read an album": use data-table reads (`db.findMany(userBadges, { where })`).
  - Fix: move it to `packages/db/src/queries/badges.ts` next to `awardBadges`.
- `apps/web/app/actions/author/controller.tsx:28` and
  `apps/web/app/actions/author/course/controller.tsx:58,71,81,119` call `getDatabase(context)`
  inside controllers, where `context.db` is typed through the `AppContext` augmentation. AGENTS
  "Adding a page" step 2 says "use `context.db` for data". `getDatabase` is meant for helpers
  that take an untyped context (`middleware/database.ts:52`).
- **Shared?** `packages/db` for the first.

### [P2] Hand-rolled coercion where `remix/data-schema/coerce` exists

- `versionForm` hand-parses `Number(value)` inside a `.transform`.
- `parseCatalogQuery` hand-reads `searchParams`.
- Guide 08 "Parse query strings and repeated fields": "The form-data schema helpers also accept
  `URLSearchParams`", with `coerce.number().refine(Number.isInteger …)`.
- A failed rollback parse also redirects without saying anything (`controller.tsx:66-68`), which
  breaks AGENTS step 5 (re-render 422 on failure).
- **Files:**
  - `apps/web/app/actions/author/course/schema.ts`
  - `apps/web/app/actions/author/course/controller.tsx:62-72`
  - `apps/web/app/actions/courses/catalog.ts:34-39`
- **Shared?** No.

### [P2] Route-area code imported across areas

- `settings/controller.tsx:32` imports `emailFailures` from `../login/controller.tsx`, which is
  one controller importing another.
- `readText`, `issueField` and `FormIssue` live in `actions/login/schema.ts` but are used by
  settings, auth/verify, auth/email, auth/email-revert, admin/invite and admin/authors.
- **Why it matters:** `.agents/skills/remix/SKILL.md`: "Keep route-local code together and share
  it only when multiple areas need it". Guide 02 "Organizing route-owned code": code shared by
  several areas belongs outside one route's directory.
- **Fix:** Move `readText`, `issueField` and `FormIssue` to e.g. `app/ui/form.ts` or
  `app/auth/form.ts`, and `emailFailures` to `app/auth/`.
- **Shared?** Touches about seven controllers (mechanical).

### [P2] `fetch()` in islands without the narrowest abort signal

- `add-passkey.tsx:37` and `passkey-button.tsx:64` call `fetch(optionsUrl, { method: 'POST' })`
  with no `signal`. `video-upload.tsx:67,86,155` does the same with its multipart calls.
- **Why it matters:** Guide 05 "Async work and cancellation": "Pass the narrowest signal into
  `fetch()` and check it after any awaited operation".
- **Fix:** Pass `handle.signal`, or the `on()` handler's signal. Low impact, since only
  unmount is affected.
- **Files:**
  - `apps/web/app/actions/settings/public/add-passkey.tsx`
  - `apps/web/app/actions/login/public/passkey-button.tsx`
  - `apps/web/app/actions/author/public/video-upload.tsx`
- **Shared?** No.

### [P2] Dead code: `PlaceholderPage`

- `apps/web/app/ui/placeholder-page.tsx` is not imported anywhere in `apps/` or `packages/`.
- AGENTS.md "Adding a page" step 6 still says to replace it, but no area uses it any more.
- **Fix:** Delete the file and step 6, or keep it as a deliberate scaffold.
- **Shared?** AGENTS.md.

### [P2] Unimplemented webhook logs an `error` (and opens a Workers Issue) on every call

- `POST /webhooks/github` returns `501`. `logServerErrors()` logs every `>= 500` at `error`.
- **Why it matters:** AGENTS.md decision 039: "`error` opens a Workers Issue, so keep it for
  things the owner should look at".
- **Fix:** Return `404`, or drop the route until the integration exists. This also ties in with
  the P1 above.
- **Files:** `apps/web/app/actions/webhooks/controller.tsx`, `apps/web/app/routes.ts:141-143`.
- **Shared?** No.

### [P2] Brand name hard-coded outside `config.ts`

- "Continue to Bits →" (`auth/verify/confirm-link-page.tsx:36`).
- "…already has a Bits account" (`settings/controller.tsx:229,422`; `login/controller.tsx:104,165`).
- `auth/config.ts:38` `name: 'Bits'`.
- **Why it matters:** AGENTS.md Layout: "`app/config.ts` … the only place the name lives".
- **Fix:** Use `APP_TITLE` / `APP_NAME`.
- **Shared?** No.

---

## Checked and found compliant (no action)

- **Client navigation:**
  - `data-rmx-document` is on OAuth (`Keycap document` in `method-row.tsx`) and on the DropZone
    form.
  - `data-rmx-reset-focus="manual"`: the catalog live search uses `navigate(..., { history:
    'replace', resetFocus: 'manual', resetScroll: 'manual' })` (guide 05 "Client navigation").
  - The progress bar is mounted outside `<body>` so the reconcile keeps it.
- **Prefetch:** every file with raw `<a>` also uses `prefetchFor` / `data-rmx-prefetch`
  (guide 05 "Prefetch links").
- **Islands:**
  - Every `clientEntry` is named.
  - Props are plain data, and endpoints are passed in from the server
    (`run`, `endpoint`, drafts URL).
  - `packages/ui` has no hard-coded app URLs outside comments and tests.
  - Every component reads props in render except `catalog-bg.tsx` (above).
  - Global listeners all take a signal. The exceptions are the once-per-page `entry.ts` and
    `navigation-feedback.ts` modules, which is fine.
- **Errors:**
  - Expected failures are 4xx renders (422, 403, 404).
  - The only 5xx are `logServerErrors` and `/health` 503 (guide 12).
  - The custom `resolveFrame` mirrors the default resolver (guide 12 "Own frame-resolution
    failures").
- **Sessions and auth:**
  - `remix/session` + `remix/middleware/session` with a custom D1 storage.
  - `remix/middleware/auth` `createSessionAuthScheme` / `requireAuth` (auth-middleware README).
  - `cop` before form parsing (guide 03 ordering).
- **Head:** `data-rmx-key` is on every `<link>`, `<script>` and theme `<meta>`, and the nonce is
  preserved with `data-rmx-preserve-attrs`.

## Top 5

1. **[P1]** Remove or disable the fake "repo connected / Saved" card and the stub
   `POST /author/repo`.
2. **[P2]** Make the 404 catch-all an ANY route, so unknown POSTs don't get a bare 405.
3. **[P2]** Replace the path regexes in `router.ts` and `headers.ts` with
   `createMatcher(routes…pattern)`.
4. **[P2]** Re-render 422 for settings validation failures, and move success notices from
   `?saved=` to session flash.
5. **[P2]** Add burst limits to the unlimited write actions (`settings.profile`, publish,
   rollback, delete, sessions).

## Not checked, and why

- **Runtime confirmation of the `CatalogBackground` stale-props replay.** I didn't start a
  server, since this was a code review. It needs a browser: on `/courses`, switch tracks and
  compare the number of chips drawn with the results.
- **Whether each island's hydration cost is justified.** I didn't measure JS per page. Bundle
  sizes come from `pnpm build`, which I didn't run here.
- **The `remix/component` README in full** (frames, `link()` mixin). The app doesn't use
  `<Frame>` (by its own documented choice), so I only skimmed the frame docs.
