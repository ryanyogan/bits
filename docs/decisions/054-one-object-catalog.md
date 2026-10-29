# 054. One object for the published catalog, shared per colo

Status: Accepted (2026-10-29). Amends 026 (the live catalog memo) and 018
(publishing).

## Context

Decision 026 memoised the live catalog per isolate. A fresh isolate still
built it from scratch: one D1 read of the live pointers, then one R2 `get`
per live course for its `manifest.json` (about 4 KB each). Production showed
`catalog;dur=190..245;desc="cold"` with `r2;dur=160..215;desc="8 reads"`,
against 0 to 18 ms warm. Every deploy discards every isolate, and with
little traffic most isolates are fresh, so most first requests paid it.

The Remix production guide ("Choose process-safe storage") warns that
process-local caches must not be relied on across replicas. Isolates are
replicas: the memo is an optimisation, never the source of truth.

## Decision

### One R2 object per publish

`publishVersion(db, bucket, slug, n, { cache })` flips the D1 pointer as
before, then `writeLiveCatalog` writes the whole published catalog as one
object, `catalog/live.json`:

```json
{ "format": 1, "generation": "what-is-an-llm@<version id>,…",
  "published_at": 1793300000000, "written_at": 1793300000123,
  "courses": [{ "version": { "id", "slug", "n" }, "manifest": { …, "updated" } }] }
```

`generation` names the live pointers the object was built from
(`slug@versionId`, in catalog order). The web publish/rollback
(`/author/:course`), the CLI (`pnpm content upload --publish`, `--remote`,
`--preview`, through `scripts/lib/upload.ts`) and the test platform all go
through `publishVersion`, so they share one code path. No column or
migration: the generation comes from rows D1 already has.

A cold isolate reads that one object: one R2 read, no D1. Lesson bodies
still load lazily from their immutable version prefixes.

### The generation check, and what a publish race does

Writes are compare-and-swap. The writer notes the object's etag (`head`),
then reads D1, then puts with `onlyIf: { etagMatches }` (or
`If-None-Match: *` when there is no object). A put whose etag moved returns
null and the writer starts again, up to four times. Because each writer
reads D1 after noting the etag, the write that lands last always read the
newest pointers: two publishes that race in any order leave the object
matching D1. The R2 put is a single object, so readers see the old object or
the new one, never a mix.

What can still go wrong is a write that never happens: the Worker dies
between the D1 flip and the put, or the put fails (then the object is
deleted, so readers rebuild). So after every read of the object from R2,
a background check (`waitUntil`, on an unmetered D1 handle so it stays out
of the request's `Server-Timing`) reads the live pointers. If they differ
from `generation`, it rebuilds the object from D1 and the manifests, keeps
the fresh catalog in the memo, swaps it into R2 over the etag it read and
drops the colo copy. The request itself never waits on D1 while an object
exists. That request is served the stale object once; versions are
immutable, so that catalog is still consistent.

An object that is missing or unreadable falls back to the old path (D1 plus
every manifest, `desc="rebuild"`), and the result is written back. A first
deploy of this change heals itself that way: CI only publishes courses
that changed, so the object may not exist until the first reader builds it.

### The colo cache in front of R2

The object also goes into the Workers Cache API (`caches.default`) for
`LIVE_CACHE_TTL_S` = 55 s, keyed by the synthetic GET URL
`<CANONICAL_ORIGIN>/_cache/catalog/live.json`, which nothing serves. A cold
isolate reads the cache first, then R2. The background check fills the
cache only after D1 agreed with the object, so a stale object is never
cached. A publish purges the key with `cache.delete` in the publishing
isolate.

The Cache API is per data centre: the delete reaches only the publisher's
colo, and the CLI reaches none. Other colos keep the old object until the
55 s TTL runs out. That is the price, and it is the same bound the memo
already had. It is a no-op on `workers.dev` (Previews), where the R2 read
does the job.

The seam is `platform.sharedCache` (`get`, `put`, `delete` of text, in
`app/platform/types.ts`). `platform.worker.ts` wraps `caches.default` and
turns every failure into a miss; `platform.node.ts` is a no-op, so app code
never branches on the runtime. Tests pass a Map-backed fake to
`liveCatalog`.

### Never block when a memo exists

`liveCatalog` now serves a memo of any age. Younger than 5 s it is used as
is (`memo`); older, it is used while one background refresh reads the cache
or the object (`stale`). Only an isolate with no catalog waits (`cache`,
`cold` or `rebuild`). The old 60 s "wait for D1" limit is gone: the refresh
is one cache or R2 read, and an idle isolate's first request no longer pays
for it.

How long a publish takes to show:

- In the publishing isolate: the next request (the memo is dropped).
- Elsewhere in that colo: within 5 s plus one request (the cache was
  purged, so the refresh reads R2).
- In other colos, or after a CLI publish: within 5 s plus up to 55 s of
  cache, about a minute, plus one request. An isolate idle for longer
  serves its old catalog to one more request while it refreshes.

### Server-Timing

`catalog;desc=` is now `memo`, `stale`, `cache` (the colo cache served
it, no R2), `cold` (the one object, `r2;desc="1 reads"`) or `rebuild`
(missing object: D1 and `N + 1` reads).

Measured under `pnpm preview` (wrangler dev, the real Worker, local state
after `pnpm db:seed:local` published 8 courses through the CLI):

```
first request:      catalog;dur=21;desc="cold"   r2;dur=6;desc="1 reads"   (no db entry)
next:               catalog;dur=0;desc="memo"
after 5 s:          catalog;dur=0;desc="stale"
new isolate:        catalog;dur=4;desc="cache"
object deleted, new isolate, cache expired:
                    db;dur=3;desc="1 queries, 1 round trips"
                    catalog;dur=17;desc="rebuild"   r2;dur=9;desc="9 reads"
```

Startup bundle: 713 KiB (710 before). Splitting the write path into a lazy
chunk made it larger (714 KiB, more chunk glue), so it stays in `store.ts`.

## Alternatives not taken

- **KV.** A new binding, and eventually consistent for up to 60 s anyway;
  the Cache API gives the same colo locality without a binding.
- **A generation column in D1.** It would let readers compare with one
  tiny query, but that is still a D1 round trip on the cold path, which is
  what this removes. The pointers themselves are the generation.
- **Purging every colo** (the zone purge API). Needs an API token in the
  Worker for a one-minute gain.

Housekeeping: nothing expires. The object is overwritten in place.
