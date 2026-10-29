// Where built courses live (decision 018).
//
// R2 (`CONTENT`) holds each version's JSON under courses/{slug}/v{n}/:
// manifest.json and lessons/{lesson}.json. D1 indexes the versions and holds
// the live pointer (packages/db/src/queries/content.ts).
//
// Versions are immutable, so their JSON is memoised per isolate, keyed by
// version id: R2 is touched only the first time an isolate sees a version.
// Which versions are live is one more R2 object, catalog/live.json, written
// on every publish (decision 054). Only resolved values are
// memoised, never promises, so no request waits on another request's I/O.
import {
  deleteVersion,
  findCourseVersion,
  listLiveCourses,
  markVersionReady,
  recordCourseBuild,
  setLiveVersion,
  type CourseVersion,
  type LiveCourse,
  type D1DataTableDatabase,
} from '@bits/db'

import type { LessonContent } from '../actions/courses/lesson/content.ts'
import { errorFields, log } from '../log.ts'
import type { SharedCache } from '../platform/types.ts'
import type { CourseBuild } from './compile/index.ts'
import { Catalog } from './catalog.ts'
import type { ContentMeter } from './meter.ts'
import type { CourseManifest } from './types.ts'

/** R2 prefix of one built version. */
export function versionPrefix(slug: string, n: number): string {
  return `courses/${slug}/v${n}`
}

const manifestKey = (slug: string, n: number) => `${versionPrefix(slug, n)}/manifest.json`
const lessonKey = (slug: string, n: number, lesson: string) => `${versionPrefix(slug, n)}/lessons/${lesson}.json`

// ---- Per-isolate memo of immutable version JSON -------------------------------

const MEMO_LIMIT = 500
const memo = new Map<string, unknown>()

function remember(key: string, value: unknown) {
  memo.set(key, value)
  // Least recently used out first (Map keeps insertion order).
  while (memo.size > MEMO_LIMIT) memo.delete(memo.keys().next().value!)
}

interface VersionRef {
  id: string
  slug: string
  n: number
}

async function readVersionJson<T>(
  bucket: R2Bucket,
  version: VersionRef,
  key: string,
  meter?: ContentMeter,
): Promise<T | undefined> {
  let memoKey = `${version.id}:${key}`
  if (memo.has(memoKey)) {
    let value = memo.get(memoKey) as T
    memo.delete(memoKey)
    memo.set(memoKey, value)
    return value
  }
  let read = async () => {
    let object = await bucket.get(key)
    return object ? await object.json<T>() : undefined
  }
  let value = meter ? await meter.timeRead(read) : await read()
  if (value === undefined) {
    console.error(JSON.stringify({ message: 'content object missing from R2', key, version: version.id }))
    return undefined
  }
  remember(memoKey, value)
  return value
}

/** Forgets every memoised version and the live catalog (tests). */
export function clearContentMemo() {
  memo.clear()
  forgetLiveCatalog()
}

// ---- Reading ----------------------------------------------------------------

function catalogOf(bucket: R2Bucket, entries: { version: VersionRef; manifest: CourseManifest }[]): Catalog {
  let versions = new Map(entries.map((entry) => [entry.manifest.slug, entry.version]))
  return new Catalog(
    entries.map((entry) => entry.manifest),
    async (course, lesson, meter) => {
      let version = versions.get(course.slug)
      return version ? readVersionJson<LessonContent>(bucket, version, lessonKey(version.slug, version.n, lesson), meter) : undefined
    },
  )
}

/** The published catalog, read from D1 and each live manifest (the authoritative path). `meter` counts its R2 reads. */
export async function loadCatalog(db: D1DataTableDatabase, bucket: R2Bucket, meter?: ContentMeter): Promise<Catalog> {
  return catalogOf(bucket, (await buildLiveObject(db, bucket, meter)).courses)
}

// ---- The one-object catalog (decision 054) ----------------------------------
//
// Every publish writes the whole published catalog as one R2 object,
// catalog/live.json: each live course's version ref and manifest. A cold
// isolate reads that one object (one R2 read, no D1) instead of the live
// pointers plus a manifest per course. Its `generation` names the live
// pointers it was built from (slug@version id, in catalog order). After an
// R2 read, a background check (waitUntil) compares it with D1, and rebuilds
// and rewrites the object when they differ, so a lost or stale write heals
// itself. Writes are compare-and-swap on the object's etag: a writer reads
// D1 after it notes the etag, and a put whose etag moved is retried, so the
// last write to land always holds the newest pointers.

/** R2 key of the published catalog object. */
export const LIVE_CATALOG_KEY = 'catalog/live.json'
/** How long the colo cache keeps the object (seconds). */
export const LIVE_CACHE_TTL_S = 55

interface LiveEntry {
  version: VersionRef
  manifest: CourseManifest
}

export interface LiveCatalogObject {
  format: 1
  /** The live pointers this was built from: `slug@versionId,…` in catalog order. */
  generation: string
  /** Newest first-publish time among the live versions (ms), for people reading the object. */
  published_at: number | null
  /** When it was built (ms). */
  written_at: number
  courses: LiveEntry[]
}

/** Where the live catalog comes from. */
export interface LiveSources {
  db: D1DataTableDatabase
  bucket: R2Bucket
  /** The colo cache (platform.sharedCache); absent means none. */
  cache?: SharedCache
  /** Keeps background work alive past the response. */
  waitUntil: (promise: Promise<unknown>) => void
  /** For work after the response (an unmetered handle, so it stays out of the request's Server-Timing); `db` when absent. */
  backgroundDb?: D1DataTableDatabase
}

function generationOf(rows: LiveCourse[]): string {
  return rows.map((row) => `${row.slug}@${row.version_id}`).join(',')
}

async function buildLiveObject(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  meter?: ContentMeter,
  rows?: LiveCourse[],
): Promise<LiveCatalogObject> {
  let live = rows ?? (await listLiveCourses(db))
  let entries = await Promise.all(
    live.map(async (row) => {
      let version = { id: row.version_id, slug: row.slug, n: row.n }
      let manifest = await readVersionJson<CourseManifest>(bucket, version, manifestKey(row.slug, row.n), meter)
      if (!manifest) return undefined
      let updated = row.published_at ? new Date(row.published_at).toISOString().slice(0, 10) : undefined
      return { version, manifest: updated ? { ...manifest, updated } : manifest }
    }),
  )
  let published = Math.max(0, ...live.map((row) => row.published_at ?? 0))
  return {
    format: 1,
    generation: generationOf(live),
    published_at: published || null,
    written_at: Date.now(),
    courses: entries.filter((entry) => entry !== undefined),
  }
}

function parseLiveObject(text: string): LiveCatalogObject | undefined {
  try {
    let value = JSON.parse(text) as Partial<LiveCatalogObject> | null
    if (value?.format === 1 && typeof value.generation === 'string' && Array.isArray(value.courses)) return value as LiveCatalogObject
  } catch {}
  return undefined
}

/** The object in R2 (undefined when missing or unreadable) and its etag, for a compare-and-swap rewrite. */
async function readLiveObject(bucket: R2Bucket, meter?: ContentMeter): Promise<{ object?: LiveCatalogObject; etag: string | null }> {
  let read = async () => {
    let found = await bucket.get(LIVE_CATALOG_KEY)
    return found ? { text: await found.text(), etag: found.etag } : undefined
  }
  let found = meter ? await meter.timeRead(read) : await read()
  if (!found) return { etag: null }
  return { object: parseLiveObject(found.text), etag: found.etag }
}

type R2OnlyIf = NonNullable<NonNullable<Parameters<R2Bucket['put']>[2]>['onlyIf']>

/** Puts the object only if R2 still holds `etag` (null: only if there is none). False when another writer got there first. */
async function putLiveObject(bucket: R2Bucket, object: LiveCatalogObject, etag: string | null): Promise<boolean> {
  let written = await bucket.put(LIVE_CATALOG_KEY, JSON.stringify(object), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache' },
    // R2Conditional has no "absent" case; the header form does (If-None-Match: *).
    onlyIf: etag ? { etagMatches: etag } : (new Headers({ 'If-None-Match': '*' }) as unknown as R2OnlyIf),
  })
  return written !== null
}

/**
 * Rebuilds catalog/live.json from D1 and swaps it in, retrying when another
 * writer got there first, then drops this colo's cached copy. Every publish
 * calls it after the D1 pointer flips (the web, the CLI, tests). Never
 * throws: the publish has already happened.
 */
export async function writeLiveCatalog(db: D1DataTableDatabase, bucket: R2Bucket, cache?: SharedCache): Promise<void> {
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      let head = await bucket.head(LIVE_CATALOG_KEY)
      // D1 after the etag: whoever swaps last read the newest pointers.
      let object = await buildLiveObject(db, bucket)
      if (await putLiveObject(bucket, object, head?.etag ?? null)) return
    }
    log('warn', 'Live catalog object kept losing the race; the newer writer holds it', {})
  } catch (error) {
    // Without the object, readers rebuild it from D1.
    log('error', 'Live catalog object write failed', errorFields(error))
    await bucket.delete(LIVE_CATALOG_KEY).catch(() => {})
  } finally {
    await cache?.delete(LIVE_CATALOG_KEY)
  }
}

/**
 * The catalog for an isolate with nothing memoised: the colo cache, else the
 * one R2 object, else (missing or unreadable) D1 and the manifests, writing
 * the object back. `keep` takes a newer catalog the background check finds.
 */
async function loadLiveCatalog(sources: LiveSources, meter: ContentMeter | undefined, keep: (catalog: Catalog) => void): Promise<Catalog> {
  let { db, bucket, cache, waitUntil } = sources
  let later = sources.backgroundDb ?? db
  let cachedText = cache ? await cache.get(LIVE_CATALOG_KEY) : undefined
  let cached = cachedText ? parseLiveObject(cachedText) : undefined
  if (cached) {
    if (meter) meter.catalog = 'cache'
    return catalogOf(bucket, cached.courses)
  }
  let { object, etag } = await readLiveObject(bucket, meter)
  if (object) {
    let served = object
    waitUntil(
      (async () => {
        // The generation check: do D1's pointers agree with what was served?
        let rows = await listLiveCourses(later)
        if (generationOf(rows) === served.generation) {
          await cache?.put(LIVE_CATALOG_KEY, JSON.stringify(served), LIVE_CACHE_TTL_S)
          return
        }
        let fresh = await buildLiveObject(later, bucket, undefined, rows)
        keep(catalogOf(bucket, fresh.courses))
        await putLiveObject(bucket, fresh, etag)
        await cache?.delete(LIVE_CATALOG_KEY)
      })().catch((error: unknown) => log('error', 'Live catalog check failed', errorFields(error))),
    )
    return catalogOf(bucket, object.courses)
  }
  if (meter) meter.catalog = 'rebuild'
  let fresh = await buildLiveObject(db, bucket, meter)
  waitUntil(putLiveObject(bucket, fresh, etag).catch((error: unknown) => log('error', 'Live catalog object write failed', errorFields(error))))
  return catalogOf(bucket, fresh.courses)
}

// ---- The live catalog, per isolate (decisions 026, 054) ----------------------
//
// The isolate keeps the last catalog and serves it stale-while-revalidate:
// younger than LIVE_FRESH_MS it is used as is; older, it is still used while
// one background refresh (waitUntil) reads the colo cache or the R2 object
// again. Only an isolate with no catalog at all waits. Versions are
// immutable, so a stale catalog is still a consistent one. After a publish
// elsewhere (another isolate, the CLI), an isolate under traffic shows the
// new version within LIVE_FRESH_MS plus the colo cache's LIVE_CACHE_TTL_S
// (about a minute), plus one request; a publish in this isolate forgets the
// memo at once. Learner progress is never part of it.

const LIVE_FRESH_MS = 5_000

let live: { catalog: Catalog; at: number } | undefined
let liveGeneration = 0
let liveRefreshing = false

/** Drops the memoised live catalog (after a publish in this isolate). */
export function forgetLiveCatalog() {
  live = undefined
  liveGeneration++
}

async function refreshLiveCatalog(sources: LiveSources, meter?: ContentMeter): Promise<Catalog> {
  let generation = liveGeneration
  let at = Date.now()
  // Don't let a slow read overwrite a newer one, or outlive a publish.
  let keep = (catalog: Catalog) => {
    if (generation === liveGeneration && (!live || live.at <= at)) live = { catalog, at }
  }
  let catalog = await loadLiveCatalog(sources, meter, keep)
  keep(catalog)
  return catalog
}

/**
 * The published catalog, from the isolate's memo whenever there is one.
 * `meter` records which path was taken and the R2 reads the request waits
 * for; a background refresh is not metered, since the request doesn't wait.
 */
export function liveCatalog(sources: LiveSources, meter?: ContentMeter): Promise<Catalog> {
  if (live) {
    if (Date.now() - live.at < LIVE_FRESH_MS) {
      if (meter) meter.catalog = 'memo'
      return Promise.resolve(live.catalog)
    }
    if (meter) meter.catalog = 'stale'
    if (!liveRefreshing) {
      liveRefreshing = true
      sources.waitUntil(
        refreshLiveCatalog({ ...sources, db: sources.backgroundDb ?? sources.db })
          .catch((error: unknown) => log('error', 'Live catalog refresh failed', errorFields(error)))
          .finally(() => {
            liveRefreshing = false
          }),
      )
    }
    return Promise.resolve(live.catalog)
  }
  if (meter) meter.catalog = 'cold'
  return refreshLiveCatalog(sources, meter)
}

/** A catalog holding just one built version of a course (the author's draft preview). */
export async function loadVersionCatalog(
  db: D1DataTableDatabase,
  slug: string,
  n: number,
  bucket: R2Bucket,
): Promise<Catalog | undefined> {
  let row = await findCourseVersion(db, slug, n)
  if (!row || row.status !== 'ready') return undefined
  let version = { id: row.id, slug, n }
  let manifest = await readVersionJson<CourseManifest>(bucket, version, manifestKey(slug, n))
  return manifest ? catalogOf(bucket, [{ version, manifest }]) : undefined
}

/** The manifest of one built version, if it built cleanly. */
export async function loadManifest(
  version: Pick<CourseVersion, 'id' | 'course_slug' | 'n' | 'status'>,
  bucket: R2Bucket,
): Promise<CourseManifest | undefined> {
  if (version.status !== 'ready') return undefined
  return readVersionJson<CourseManifest>(bucket, { id: version.id, slug: version.course_slug, n: version.n }, manifestKey(version.course_slug, version.n))
}

// ---- Writing ----------------------------------------------------------------

export interface SaveOptions {
  /** "cli", "folder upload", … */
  source: string
  /** The uploader, recorded as a course author. */
  userId?: string | null
  /** Admins and the CLI may build any course; others only their own or a new one. */
  trusted: boolean
  now?: number
}

/**
 * Records a build as the course's next version. D1 assigns n first, so a
 * clean build's JSON goes to R2 under a v{n} prefix nothing else writes;
 * then the version is marked ready. A build with errors is a report only.
 * Null when the uploader may not build this course (see recordCourseBuild).
 */
export async function saveBuild(
  db: D1DataTableDatabase,
  build: CourseBuild,
  options: SaveOptions,
  bucket: R2Bucket,
): Promise<CourseVersion | null> {
  let version = await recordCourseBuild(db, {
    id: crypto.randomUUID(),
    slug: build.slug,
    title: build.title,
    track: build.track,
    sort: build.sort,
    errors: build.errors,
    warnings: build.warnings,
    report: build.report,
    files: build.files,
    source: options.source,
    userId: options.userId ?? null,
    trusted: options.trusted,
    now: options.now ?? Date.now(),
  })
  if (!version) return null
  if (version.status === 'failed' || !build.manifest || !build.lessons) return version

  let put = (key: string, value: unknown, customMetadata?: Record<string, string>) =>
    bucket.put(key, JSON.stringify(value), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata,
    })
  try {
    let hash = await buildHash(build)
    await Promise.all([...build.lessons].map(([lesson, content]) => put(lessonKey(build.slug, version.n, lesson), content)))
    // The manifest last: a version whose manifest exists is complete. It
    // carries the build's hash, so the CLI can tell an unchanged build.
    await put(manifestKey(build.slug, version.n), build.manifest, hash ? { [BUILD_HASH_KEY]: hash } : undefined)
    await markVersionReady(db, version.id)
  } catch (error) {
    await deleteVersion(db, version.id)
    throw error
  }
  return { ...version, status: 'ready' }
}

// ---- Build hashes (decision 036) ---------------------------------------------
//
// A clean build's output (the manifest and every lesson's JSON) hashed. The
// output already holds the linked video ids and whatever the compiler made
// of the sources, so two builds with the same hash serve the same course.
// Stored as custom metadata on the version's manifest object: no column.

const BUILD_HASH_KEY = 'build-sha256'

/** SHA-256 (hex) of a clean build's output; undefined for a build with errors. */
export async function buildHash(build: CourseBuild): Promise<string | undefined> {
  if (!build.manifest || !build.lessons) return undefined
  let lessons = [...build.lessons].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  let bytes = new TextEncoder().encode(JSON.stringify({ manifest: build.manifest, lessons }))
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The hash a saved version's manifest carries; undefined for versions saved before 036. */
export async function readBuildHash(bucket: R2Bucket, slug: string, n: number): Promise<string | undefined> {
  let object = await bucket.head(manifestKey(slug, n))
  return object?.customMetadata?.[BUILD_HASH_KEY]
}

/**
 * Makes version `n` live (publish) or live again (rollback), then rewrites
 * catalog/live.json and drops this colo's cached copy (decision 054). False
 * if it can't go live.
 */
export async function publishVersion(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  slug: string,
  n: number,
  options: { cache?: SharedCache; now?: number } = {},
): Promise<boolean> {
  let published = await setLiveVersion(db, slug, n, options.now ?? Date.now())
  if (published) await writeLiveCatalog(db, bucket, options.cache)
  forgetLiveCatalog()
  return published
}
