# 026. Server performance: fewer D1 round trips, a smaller startup bundle

Status: Accepted (2026-10-27). Amends 018 (catalog loading) and 020 (D1 round trips).

## Context

Production (`bits.yogan.dev`) runs the Worker pinned next to D1 (ORD,
commit 6ad045a). Lesson TTFB was about 185 ms, of which roughly 60–75 ms is
the network to the edge (a static asset from the same host takes that long).
The rest is the Worker: its D1 round trips and, on a cold isolate, loading a
1.4 MiB bundle.

Measured locally with the new meter (below), before this change:

| Page | Signed out (no cookie) | Signed in |
|---|---|---|
| `/` | 0 queries | 2 queries, 2 round trips |
| `/courses` | 1, 1 | 4, 3 |
| `/courses/:course` | 1, 1 | 4, 3 |
| `/courses/:course/:lesson` | 1, 1 | 4, 3 |
| `/me` | (redirect) | 9, 4 |

Signed in, every page waited on D1 for the session, then the user, then
the live catalog and the completed lessons together. Signed out, every
catalog page read the live-version pointers.

The Worker bundle was 1465 KiB minified. `wrangler deploy` re-bundled it
without minifying (1836 KiB uploaded, 415 KiB gzip). Of that, the Anthropic
SDK was 332 KiB, the content compiler (yaml, micromark, mdast,
character-entities) about 230 KiB, the styleguide about 45 KiB, and the
inlined asset manifest 178 KiB.

## Decision

### Meter every request's D1 use

`loadDatabase` builds `context.db` per request over a metered view of the D1
binding (`meterD1` in `@bits/db`). There is no AsyncLocalStorage without
`nodejs_compat`, so the meter has to be per request. The binding is shared,
and the wrappers are small objects. The meter counts statements, binding calls,
**round trips** (periods with at least one call in flight, so parallel
queries count once) and the wall time of those periods. Every response that
touched D1 carries

```
Server-Timing: db;dur=4;desc="2 queries, 1 round trips"
```

in dev and production. Use it in devtools or with `curl -I`. A request with 250 ms
or more of D1 time logs a `Slow D1 request` warning. Nothing else is
logged per request, so log volume doesn't grow. The session store and
`loadAuth` now use `context.db` too, so their queries are counted.

### One round trip for the session, user and progress

- `readSessionWithUser` reads the session row with its user in one
  statement (`sessions left join users`). `identity.ts` verifies against
  that row (`userLoadedWith`) and falls back to `findUserById` only for a
  session that didn't come from D1 in this request.
- On `GET /courses…` (router.ts, `loadSession({ withCompleted })`), the same
  read is a two-statement `db.batch` that also returns the viewer's
  completed lessons. The subquery is keyed by the session id hash.
  `loadCompleted` uses those rows (`completedLoadedWith`). They're read in the
  same request, so progress is never staler than before. Writes (POSTs)
  never use the prefetch, so a request that writes progress reads it fresh.

### The live catalog is memoised per isolate, stale-while-revalidate

Which version of each course is live changes only on publish. `liveCatalog`
(store.ts) keeps the last `Catalog` in the isolate:

- younger than 5 s: used as is;
- 5–60 s: used, while one background refresh (`waitUntil`) re-reads D1;
- older: the request waits for D1.

After a publish from elsewhere (another isolate, the CLI), an isolate can
show the previous version for at most 5 s plus one request, and never for
more than 60 s. Versions are immutable, so a stale catalog is still
consistent: the old manifest and lesson bodies are still in R2. A publish
in this isolate (`publishVersion`) drops the memo at once. A generation counter
stops an in-flight refresh from overwriting a newer state. Learner
progress is never part of the memo. Only resolved values are shared across
requests, never promises, as before.

The Cache API was not used. It would still cost a subrequest per page,
it's per colo, and invalidating it on publish needs the purge API. KV was
not used either: it adds a binding and eventual consistency for no gain
over an in-isolate memo.

### After

| Page | Signed out (no cookie) | Signed out (visitor cookie) | Signed in |
|---|---|---|---|
| `/` | 0 | 1 query, 1 round trip | 1, 1 |
| `/courses` | 0 (warm) | 2, 1 | 2, 1 |
| `/courses/:course` | 0 | 2, 1 | 2, 1 |
| `/courses/:course/:lesson` | 0 | 2, 1 | 2, 1 |
| `/me` | (redirect) | (redirect) | 7, 2 |

The signed-out and signed-in columns were measured with `Server-Timing`
on the Node dev server and again under `wrangler dev`. The visitor-cookie
column comes from reading the code, not from a measurement: it is the same
path as signed in, with no user row. Before this change it was 2 round trips.

`/me` is the session read, then the six profile queries in parallel. They
run in `app/actions/profile/data.ts`, outside this change. Turning them into
one `db.batch` would save subrequests but not a round trip.

### D1 read replication was not adopted

Replicas cut latency for Workers far from the primary. This Worker is
pinned next to the primary, so a replica read would save little. Each
page would also need the Sessions API with bookmarks carried between
requests to keep read-after-write (a learner sees the lesson they just
completed). Revisit if placement changes or if traffic moves to other
regions.

### Split the Worker bundle; load rare code lazily

- `scripts/build.ts` builds with esbuild `splitting` into
  `build/worker/index.js` plus `build/worker/chunks/*.js`.
- `wrangler.jsonc` sets `no_bundle: true` and an `ESModule` rule for
  `**/*.js`. Wrangler uploads the build as is: minified, and each chunk as
  its own module. Per the Wrangler bundling docs, a module that is only
  imported dynamically "would only be loaded and executed at runtime when
  it is actually imported".
- Dynamic imports:
  - `@anthropic-ai/sdk` in `app/runs/model.ts`, loaded on the first live run
    and then memoised. It is still the only file that imports the SDK.
  - The content compiler in `POST /api/author/upload`.
    `author/data.ts` imports `formatItem` from `compile/report.ts`, not the
    compile index.
  - The styleguide page in its controller.
- The asset manifest is inlined *packed* (`app/platform/packed-manifest.ts`).
  Each distinct string is stored once and the tree refers to strings by
  index. `platform.worker.ts` unpacks it at startup. This took it from
  178 KiB to 29 KiB.

| | Before | After |
|---|---|---|
| Code loaded at startup | 1465 KiB (one module) | 604 KiB (entry + 4 static chunks) |
| All modules | 1465 KiB | 1328 KiB in 13 modules |
| `wrangler deploy --dry-run` | 1836 KiB / gzip 415 KiB | 1328 KiB / gzip 377 KiB |
| Parse + evaluate the entry, local V8 (median of 15 fresh processes) | 59 ms | 34 ms |

The last row comes from Node with `cloudflare:workers` stubbed, loading the
artifact wrangler actually uploads (before: wrangler's re-bundled file).
`wrangler check startup` profiles were too coarse to tell the two apart
locally (5–12 samples each). The production startup time should be read
from the deploy output or the dashboard after deploying.

## Consequences

- Look at `Server-Timing: db` when changing a page. A new sequential
  `await` on D1 shows up there as an extra round trip.
  `app/actions/courses/lesson/controller.test.ts` pins the signed-in lesson
  page at 2 queries and 1 round trip, and a warm signed-out page at none.
- Code that only a rare route or action needs should be imported with
  `await import()` at the point of use. Static imports land in the startup
  bundle. `pnpm build` prints the startup size.
- Don't read `listLiveCourses` directly for pages. Use `getCatalog`, which
  goes through the memo. Code that changes the live pointer must go through
  `publishVersion`, so this isolate forgets the memo.
- `pnpm preview` and `pnpm deploy` upload `build/worker` as built. Wrangler
  no longer bundles, so anything the build doesn't put there won't be
  deployed.
