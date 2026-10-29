// The one-object catalog (decision 054): catalog/live.json in R2, the colo
// cache in front of it, the generation check and the isolate's memo.
import { listLiveCourses } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import type { SharedCache } from '../platform/types.ts'
import { testDb } from '../test/auth.ts'
import { ContentMeter } from './meter.ts'
import {
  LIVE_CATALOG_KEY,
  clearContentMemo,
  liveCatalog,
  loadCatalog,
  publishVersion,
  writeLiveCatalog,
  type LiveCatalogObject,
  type LiveSources,
} from './store.ts'

const bucket = platform.env.CONTENT

/** A Map standing in for the Workers Cache API, recording what was asked of it. */
function fakeCache() {
  let entries = new Map<string, string>()
  let calls: string[] = []
  let cache: SharedCache = {
    async get(key) {
      calls.push(`get ${key}`)
      return entries.get(key)
    },
    async put(key, body, maxAge) {
      calls.push(`put ${key} ${maxAge}`)
      entries.set(key, body)
    },
    async delete(key) {
      calls.push(`delete ${key}`)
      entries.delete(key)
    },
  }
  return { cache, entries, calls }
}

/** Sources whose background work the test can wait for. */
function sources(cache?: SharedCache) {
  let pending: Promise<unknown>[] = []
  let value: LiveSources = { db: testDb, bucket, cache, waitUntil: (promise) => pending.push(promise) }
  return { sources: value, settle: () => Promise.all(pending.splice(0)) }
}

async function readObject(): Promise<LiveCatalogObject | undefined> {
  return (await (await bucket.get(LIVE_CATALOG_KEY))?.json<LiveCatalogObject>()) ?? undefined
}

async function expectedGeneration() {
  return (await listLiveCourses(testDb)).map((row) => `${row.slug}@${row.version_id}`).join(',')
}

async function cold(cache?: SharedCache) {
  clearContentMemo()
  let meter = new ContentMeter()
  let run = sources(cache)
  let catalog = await liveCatalog(run.sources, meter)
  return { catalog, meter, ...run }
}

// One flat suite: the platform (D1, R2) stays up until the last test.
describe('the one-object live catalog', () => {
  after(() => disposePlatform())

  it('is written by every publish the test platform made, with the D1 generation', async () => {
    let object = await readObject()
    assert.ok(object)
    assert.equal(object.format, 1)
    assert.equal(object.generation, await expectedGeneration())
    let authoritative = await loadCatalog(testDb, bucket)
    assert.deepEqual(
      object.courses.map((entry) => entry.manifest.slug),
      authoritative.courses.map((course) => course.slug),
    )
  })

  it('loads cold from the one object: one R2 read, no D1', async () => {
    let authoritative = await loadCatalog(testDb, bucket)
    let { catalog, meter, settle } = await cold()
    assert.equal(meter.catalog, 'cold')
    assert.equal(meter.reads, 1)
    assert.deepEqual(catalog.courses, authoritative.courses)
    // Lesson bodies still load through the version refs it carries.
    let first = catalog.courses[0]!
    assert.ok(await catalog.lessonContent(first.slug, first.modules[0]!.lessons[0]!.slug))
    await settle()
  })

  it('falls back to D1 and the manifests when the object is missing, and writes it back', async () => {
    await bucket.delete(LIVE_CATALOG_KEY)
    let { catalog, meter, settle } = await cold()
    assert.equal(meter.catalog, 'rebuild')
    assert.equal(meter.reads, catalog.courses.length + 1)
    await settle()
    let object = await readObject()
    assert.equal(object?.generation, await expectedGeneration())
    assert.equal(object?.courses.length, catalog.courses.length)
  })

  it('treats an unreadable object as missing and replaces it', async () => {
    await bucket.put(LIVE_CATALOG_KEY, '{"format":0}')
    let { meter, settle } = await cold()
    assert.equal(meter.catalog, 'rebuild')
    await settle()
    assert.equal((await readObject())?.generation, await expectedGeneration())
  })

  it('serves an object whose generation D1 disagrees with, then rebuilds, rewrites and keeps the fresh one', async () => {
    let good = (await readObject())!
    let stale: LiveCatalogObject = { ...good, generation: 'old@gone', courses: good.courses.slice(0, 1) }
    await bucket.put(LIVE_CATALOG_KEY, JSON.stringify(stale))
    let { cache, entries, calls } = fakeCache()
    let { catalog, meter, settle, sources: live } = await cold(cache)
    assert.equal(meter.catalog, 'cold')
    assert.equal(catalog.courses.length, 1)
    await settle()
    let rewritten = await readObject()
    assert.equal(rewritten?.generation, await expectedGeneration())
    assert.equal(rewritten?.courses.length, good.courses.length)
    // The colo cache never got the stale copy, and was purged after the rewrite.
    assert.equal(entries.size, 0)
    assert.ok(calls.includes(`delete ${LIVE_CATALOG_KEY}`))
    // The isolate's memo holds the fresh catalog now.
    let memoMeter = new ContentMeter()
    let next = await liveCatalog(live, memoMeter)
    assert.equal(memoMeter.catalog, 'memo')
    assert.equal(next.courses.length, good.courses.length)
  })

  it('reads the colo cache first, filling it after an R2 read', async () => {
    let { cache, entries, calls } = fakeCache()
    let first = await cold(cache)
    assert.equal(first.meter.catalog, 'cold')
    await first.settle()
    assert.ok(entries.has(LIVE_CATALOG_KEY))
    assert.ok(calls.includes(`put ${LIVE_CATALOG_KEY} 55`))

    let second = await cold(cache)
    assert.equal(second.meter.catalog, 'cache')
    assert.equal(second.meter.reads, 0)
    assert.deepEqual(second.catalog.courses, first.catalog.courses)
    assert.deepEqual(second.meter.serverTiming(), [`catalog;dur=0;desc="cache"`])
  })

  it('serves a memo of any age while one refresh runs in the background', async () => {
    let { catalog, settle, sources: live } = await cold()
    await settle()
    let realNow = Date.now
    try {
      let later = realNow() + 10 * 60_000
      Date.now = () => later
      let meter = new ContentMeter()
      let served = await liveCatalog(live, meter)
      assert.equal(meter.catalog, 'stale')
      assert.equal(meter.reads, 0)
      assert.equal(served, catalog)
      let again = new ContentMeter()
      await liveCatalog(live, again)
      assert.equal(again.catalog, 'stale')
      await settle()
      // The refresh replaced the memo: fresh again.
      let after = new ContentMeter()
      let refreshed = await liveCatalog(live, after)
      assert.equal(after.catalog, 'memo')
      assert.notEqual(refreshed, catalog)
    } finally {
      Date.now = realNow
      clearContentMemo()
    }
  })

  it('rewrites the object on publish and drops the colo copy', async () => {
    let row = (await listLiveCourses(testDb))[0]!
    await bucket.delete(LIVE_CATALOG_KEY)
    let { cache, entries } = fakeCache()
    entries.set(LIVE_CATALOG_KEY, 'old')
    assert.equal(await publishVersion(testDb, bucket, row.slug, row.n, { cache }), true)
    assert.equal(entries.size, 0)
    assert.equal((await readObject())?.generation, await expectedGeneration())
  })

  it('lets the newest writer win a race: a swap on a moved etag retries against D1', async () => {
    // Another writer lands between this writer's head and its put.
    let raced = false
    let racing = {
      get: (key: string) => bucket.get(key),
      put: (...args: Parameters<R2Bucket['put']>) => bucket.put(...args),
      delete: (key: string) => bucket.delete(key),
      async head(key: string) {
        let head = await bucket.head(key)
        if (!raced) {
          raced = true
          await bucket.put(LIVE_CATALOG_KEY, JSON.stringify({ format: 1, generation: 'other', written_at: 0, published_at: null, courses: [] }))
        }
        return head
      },
    } as unknown as R2Bucket
    await writeLiveCatalog(testDb, racing)
    assert.ok(raced)
    assert.equal((await readObject())?.generation, await expectedGeneration())
  })
})
