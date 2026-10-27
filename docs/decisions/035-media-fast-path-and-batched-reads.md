# 035. Media skips the session; profile and author pages read in one batch

Status: Accepted (2026-10-27). Follows 026 (D1 round trips) and 029 (video).

## Context

Two follow-ups were left open:

- Decision 029: every `GET /media/videos/:id.mp4` went through the whole
  router middleware. A `<video>` makes a Range request for each seek and
  chunk, and each one paid a session read from D1 (1 query, 1 round trip,
  measured), plus cop, form-data and auth setup that a public, immutable
  file never needs.
- Decision 026: `/me` ran six profile queries in parallel after the session
  read: 7 queries, 2 round trips, 7 D1 binding calls (subrequests).

## Decision

### Media is answered by router middleware, before the session

`serveMedia()` (`app/middleware/media.ts`) matches `routes.media.video.pattern`
with `remix/route-pattern`'s `createMatcher` and, for `GET`/`HEAD`, returns
`serveVideo(request, id)` without calling `next()`. The Remix
request-handling guide describes this pattern for static files and caches:
put the fast path before the work it doesn't need.

- It sits right after `responseHeaders()`, so videos keep HSTS, `nosniff`,
  `Referrer-Policy` and `Permissions-Policy`. They get no CSP or HTML
  Cache-Control, because they aren't HTML. `serveVideo` still sets
  `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: public,
  max-age=31536000, immutable`, the ETag and `Accept-Ranges`.
- It runs before `platform.middleware`, cop, `loadDatabase`, `loadSession`,
  `formData`, `loadAuth` and `render`. A media response never sets a cookie
  and never touches D1.
- It is router middleware, not a branch in `worker.ts`. Node (dev, tests)
  and Workers take the same path, so app code never branches on the runtime.
- `actions/media/controller.tsx` stays mapped. It keeps the route map whole
  (`remix doctor` warns about a route map with no actions directory) and
  would serve the same response if the middleware were removed.
- The hotlink guard, Range, 304 and 416 behaviour is unchanged. The
  `app/video/video.test.ts` tests still pass, and a new one pins a
  signed-in Range request at no `Server-Timing` (0 queries) and no
  `Set-Cookie`.

**The Cache API was not adopted.** We checked the Cloudflare docs through
Context7 (developers.cloudflare.com, 2026-10-27):

- `cache.put` throws on a `206`. To cache, the Worker would have to read and
  store the whole object, even though the browser asked for one range.
- Cacheable objects are capped at 512 MB on Free/Pro/Business, and uploads
  go up to 2 GB.
- The newer "Workers Caching" feature (`cache.enabled` in wrangler config)
  slices Ranges from a cached full `200`. But it strips the `Range` header
  before the Worker runs, so a miss reads the whole file from R2. It applies
  to the whole Worker, and at launch it carries the Free plan's size limit.
  A cache HIT would also skip the hotlink check (the `Referer` and
  `Sec-Fetch-Site` test), leaving only CORP.

R2 reads in the same region as the pinned Worker are cheap (Class B,
10M a month free), and browsers cache the immutable responses for a year,
so we rely on those two. Revisit if video traffic grows or if Workers
Caching lifts its limits.

### Profile reads are one batch, and on /me part of the session read

`packages/db/src/queries/profile.ts` builds the six profile statements
(completed lessons, the last 50 journal entries, the journal count, badges,
activity days and identities) against a `UserRef`: a SQL expression for
the user id, plus the values for its placeholders.

- **`/me`**: `loadSession({ withProfile })` in `router.ts` adds the six
  statements to the session read's batch. They are keyed by the
  session-id subquery, the same way `withCompleted` and `withDrafts` work
  (decisions 026 and 029). `profileLoadedWith(session, userId)` hands the
  rows to the controller. `getOwnProfile` falls back to its own batch
  (`readProfileRows`) when it has no rows.
- **`/u/:handle`**: `readPublicProfile` runs one batch: the user by handle
  plus the six reads, keyed by `(select id from users where handle = ? and
  is_public = 1)`. A private profile's rows are never read.
- **Certificates**: `readUserWithCompleted` reads the user by handle and
  their completed lessons in one batch. The page still checks visibility in
  code, because the owner may see a private certificate.
- **The activity window** has to be bound before the user row (with its
  timezone) is known. `profileReadOptions()` starts it at UTC today minus
  182 days. A local today is always within a day of UTC's, so this covers
  the 182-day heatmap for any timezone. The one extra day is never drawn.

### /author and /author/:course: one batch after the session

`readAuthorCourses(db, { user } | { slug })` (`queries/content.ts`) reads the
managed courses, every build, the course authors and the video uploads in
one 4-statement batch. Each statement is scoped by the same slug subquery.
Before, the page listed the courses, then ran 3 queries for each course:
26 binding calls and 3 round trips with the test catalogue's 8 courses.

### After

Measured in-process (`router.fetch` under `NODE_ENV=test`, the meter's
statement, round-trip and binding-call counts, warm catalog memo), then
checked again on the built Worker under `wrangler dev` with `curl`.

| Page | Before (queries / round trips / calls) | After |
|---|---|---|
| `/media/videos/:id.mp4` Range, signed in | 1 / 1 / 1 | **0** / 0 / 0 |
| `/me` | 7 / 2 / 7 | 7 / **1** / **1** |
| `/u/:handle`, no cookie | 7 / 2 / 7 | 7 / **1** / **1** |
| `/u/:handle`, signed in | 8 / 3 / 8 | 8 / **2** / **2** |
| certificate, no cookie | 2 / 2 / 2 | 2 / **1** / **1** |
| certificate, signed in | 3 / 3 / 3 | 3 / **2** / **2** |
| `/author` (8 courses) | 26 / 3 / 26 | **5** / **2** / **2** |
| `/author/:course` | 5 / 3 / 5 | 5 / **2** / **2** |
| `/settings` | 5 / 2 / 5 | unchanged |
| `/courses`, lesson pages | 2–3 / 1 / 1 | unchanged |

On `wrangler dev`, a warm `/me` was `7 queries, 1 round trips`, `/author`
and `/author/:course` were `5 queries, 2 round trips`, a signed-out
`/u/demo` was `7 queries, 1 round trips`, and a signed-in Range request was
`206` with no `Server-Timing` and the security headers present. The first
request after a minute idle shows one extra query and round trip: the
live-catalog memo's blocking refresh (decision 026), not this change.

### Not changed

- **`/settings`** is 2 round trips and 5 calls: the session read, then
  identities, sessions, passkeys and the pending email change in parallel.
  Batching them would save 3 subrequests but no round trip. It would also
  mean copying SQL out of three query modules (`auth.ts`, `passkeys.ts`,
  the email-change queries). The page is `no-store` and rarely visited.
- **`/u/:handle` and certificates, signed in**, stay at 2 round trips: the
  viewer's session read, then the batch. Folding a different user's reads
  into the viewer's session batch isn't worth the coupling.
- **Writes** (POSTs) are unchanged. They read fresh on purpose.

## Consequences

- Public, immutable, non-HTML responses that need neither the session nor
  D1 should be answered by router middleware before `loadDatabase`, as
  `serveMedia()` is. Keep it after `responseHeaders()` so the security
  headers still apply.
- When a page reads several things about one user or course, build the
  statements against a subquery (`UserRef`, the slug subquery) and send
  them in one `db.batch`. If the page's URL is known before routing, they
  can join the session read the way `withProfile` does.
- Tests pin the counts: `profile/controller.test.ts` (`/me` and `/u/:handle`
  at 1 round trip), `certificates/controller.test.ts`,
  `author/controller.test.ts`, `video/video.test.ts` (media at 0), and
  `packages/db/src/queries/profile.test.ts` (one binding call, same rows
  as the single queries).
