# 045. No ETag on HTML; polish-wave leftovers

Status: Accepted (2026-10-27). Follows 020, 026, 027, 035, 040, 042 and 044.

## Context

Decision 042 made page links prefetch on intent and noted that HTML is
`private, no-cache`, so the prefetched page is fetched again on the click:
"An `ETag` on HTML would let navigation revalidate the prefetched copy
instead (left to the app)." This record decides that, and closes the other
leftovers of the 040–044 polish wave.

What we read:

- RFC 9110 §8.8.3 and §13.1.2 (ETag, If-None-Match), RFC 9111 §4.3.4
  (freshening a stored response from a 304: the 304's header fields
  replace the stored ones), and MDN's HTTP caching, 304 and CSP guides
  (fetched 2026-10-27). MDN: a CSP nonce "must be different for every
  HTTP response, and must not be predictable"; a 304 carries the headers
  a 200 would have sent.
- The installed Remix 3.1 runtime: `@remix-run/component`
  `src/runtime/prefetch.ts` and `run.ts`, and the component README's
  "Prefetching". The default prefetch fetches the page's HTML (`X-Remix-Frame:
  true`, `priority: low`), reads it into an inert `<template>`, and adds
  `<link rel="prefetch">` for its modules, CSS and preloads. Navigation then
  uses the default resolver and the HTTP cache. `run({ prefetch,
  resolveFrame })` exists "to reuse uncacheable HTML, for example to hold the
  response in memory until the next navigation to that URL and target".
- Client navigations never run the new page's nonced scripts: the runtime
  reconciles the HTML and imports modules itself, and import-map deltas
  reuse the current document's nonce (`import-map-manager.ts`). Only a
  document load checks the response's own nonce.

## Decision

### No ETag on HTML

Every HTML response carries a fresh nonce in both the CSP header and the
body (027). A validator would have to ignore the nonce (hash the body with
it masked), and then a 304 is wrong one of two ways:

1. **The 304 carries the new CSP.** RFC 9111 §4.3.4 replaces the stored
   header with it, so the cached body's nonce no longer matches. On a
   document load (a reload, a back navigation the bfcache missed, the 5xx
   fallback in `entry.ts`) every script is blocked: no islands, no client
   navigation.
2. **The 304 omits the CSP**, so the stored header and body stay paired.
   That replays an old nonce on a new response, which is what nonces exist
   to prevent, and the server must also strip the header the
   `responseHeaders()` middleware adds to every HTML response.

And the win is small even when it's safe:

- The server still runs the whole request (session read, D1 batch,
  render) to compute the tag, and has to buffer the streamed body to hash
  it. A 304 saves only the transfer of a few KB of compressed HTML, not
  TTFB, which is the part a click waits on (043: 12–40 ms warm).
- The pages people move between most (`/me`, `/settings`, `/login`) are
  `no-store` (027), so nothing would be cached to revalidate anyway.
- 042 already gets the large part: the prefetch warms the next page's
  modules, CSS and font preloads in the HTTP cache.

So HTML stays `private, no-cache` with no validator.

### The alternative, not built now: reuse the prefetched response in memory

If the click-after-hover round trip ever matters, the way is the one the
runtime documents: a custom `prefetch` that keeps the fetched response,
plus a `resolveFrame` that hands it over once. A safe version:

- keep at most one entry per URL, for a few seconds (the hover to click
  gap), and use it once;
- only for a top-frame GET with no form data; anything else, and any POST
  or reload, clears the store first, so a page can't be shown from before
  a write;
- otherwise copy the default resolver's checks (same-origin, `5xx` and
  non-HTML redirects throw, so `entry.ts`'s fallback still runs).

The nonce isn't a problem there, because client navigations don't use it
(see Context). We didn't build it: it reimplements the runtime's
unexported `defaultResolveFrame`, a stale-page bug is worse than a 20 ms
wait, and it lives in `app/actions/public/entry.ts`, outside this pass's
files. Revisit with a measurement that shows the gap matters (for example
`/courses` → lesson on a slow phone).

### Polish-wave leftovers

- **Landing tokens** (`tokens.css`, from `docs/design/spec/tokens.md`
  "Type" and "Layout"): `--type-display-cta-size` (`clamp(42px, 7vw,
  104px)`), `--type-display-cta-leading` (0.96), `--type-display-cta-measure`
  (1000px), `--type-display-xl-measure` (1100px) and `--hero-min-height`
  (820px). The hero and the closing CTA use them; no value changed.
- **`@bits/ui/lib/states`** is an explicit export. The `./*` pattern maps
  to `.tsx`, so `states.ts` wasn't importable from the app.
- **Badge toast on `/styleguide`**: a `RewardToast` with a badge (the hex in
  place of the check, the "Badge earned" title, the profile link), as the
  completion toast renders it (028).
- **`/settings` reads in one batch.** Identities, sessions, passkeys and
  the open email change were four parallel D1 calls. They are now one
  `db.batch` (`readSettingsRows`, `packages/db/src/queries/settings.ts`):
  one binding call instead of four, still 5 queries and 2 round trips
  (the session read, then the batch). The statements take a `UserRef`,
  like the profile's, so they can join the session read and make the page
  one round trip. That step needs `readSessionWithUser`, `loadSession`
  (`app/auth/session.ts`) and `router.ts`, which this pass didn't own; the
  controller test pins the count, so the change will show up there.
- **Tests**: a unit test that `SegmentedTabs keepPlace` puts
  `data-rmx-reset-focus/scroll="manual"` on every tab and nothing without
  it (044's e2e already checks focus stays on the tab); axe cases for the
  landing's phone menu sheet and its scrolled, frosted header at 360 and
  1440; `settings.test.ts` in `@bits/db` (same rows as the separate
  queries, one call, one wave).

## Consequences

- Don't add `ETag` or `Last-Modified` to HTML responses. Static assets
  keep their own caching (`_headers`); the media path keeps its immutable
  caching (035).
- A new Settings read goes into `settingsStatements`, not beside it.
- Joining the settings batch to the session read is the next step for
  `/settings` (the owners of `app/auth/` and `router.ts`).
