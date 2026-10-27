// Where built courses live (decision 018).
//
// R2 (`CONTENT`) holds each version's JSON under courses/{slug}/v{n}/:
// manifest.json and lessons/{lesson}.json. D1 indexes the versions and holds
// the live pointer (packages/db/src/queries/content.ts).
//
// Versions are immutable, so their JSON is memoised per isolate, keyed by
// version id: a page costs one D1 query for the live pointers and touches R2
// only the first time an isolate sees a version. Only resolved values are
// memoised, never promises, so no request waits on another request's I/O.
import {
  deleteVersion,
  findCourseVersion,
  listLiveCourses,
  markVersionReady,
  recordCourseBuild,
  setLiveVersion,
  type CourseVersion,
  type D1DataTableDatabase,
} from '@bits/db'

import type { LessonContent } from '../actions/courses/lesson/content.ts'
import { errorFields, log } from '../log.ts'
import type { CourseBuild } from './compile/index.ts'
import { Catalog } from './catalog.ts'
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

async function readVersionJson<T>(bucket: R2Bucket, version: VersionRef, key: string): Promise<T | undefined> {
  let memoKey = `${version.id}:${key}`
  if (memo.has(memoKey)) {
    let value = memo.get(memoKey) as T
    memo.delete(memoKey)
    memo.set(memoKey, value)
    return value
  }
  let object = await bucket.get(key)
  if (!object) {
    console.error(JSON.stringify({ message: 'content object missing from R2', key, version: version.id }))
    return undefined
  }
  let value = await object.json<T>()
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
    async (course, lesson) => {
      let version = versions.get(course.slug)
      return version ? readVersionJson<LessonContent>(bucket, version, lessonKey(version.slug, version.n, lesson)) : undefined
    },
  )
}

/** The published catalog: every live course at its live version. */
export async function loadCatalog(db: D1DataTableDatabase, bucket: R2Bucket): Promise<Catalog> {
  let live = await listLiveCourses(db)
  let entries = await Promise.all(
    live.map(async (row) => {
      let version = { id: row.version_id, slug: row.slug, n: row.n }
      let manifest = await readVersionJson<CourseManifest>(bucket, version, manifestKey(row.slug, row.n))
      if (!manifest) return undefined
      let updated = row.published_at ? new Date(row.published_at).toISOString().slice(0, 10) : undefined
      return { version, manifest: updated ? { ...manifest, updated } : manifest }
    }),
  )
  return catalogOf(bucket, entries.filter((entry) => entry !== undefined))
}

// ---- The live catalog, per isolate (decision 026) ----------------------------
//
// Which version of each course is live changes only on publish, yet reading
// it was a D1 round trip on every page. The isolate keeps the last catalog
// and serves it stale-while-revalidate: younger than LIVE_FRESH_MS it is used
// as is; up to LIVE_MAX_AGE_MS it is used while one background refresh
// (waitUntil) re-reads D1; older, the request waits for D1. So after a
// publish elsewhere (another isolate, the CLI), an isolate shows the old
// version for at most LIVE_FRESH_MS plus one request, never more than
// LIVE_MAX_AGE_MS. A publish in this isolate forgets it at once. Versions are
// immutable, so a stale catalog is still a consistent one. Learner progress
// is never part of it.

const LIVE_FRESH_MS = 5_000
const LIVE_MAX_AGE_MS = 60_000

let live: { catalog: Catalog; at: number } | undefined
let liveGeneration = 0
let liveRefreshing = false

/** Drops the memoised live catalog (after a publish in this isolate). */
export function forgetLiveCatalog() {
  live = undefined
  liveGeneration++
}

async function refreshLiveCatalog(db: D1DataTableDatabase, bucket: R2Bucket): Promise<Catalog> {
  let generation = liveGeneration
  let at = Date.now()
  let catalog = await loadCatalog(db, bucket)
  // Don't let a slow read overwrite a newer one, or outlive a publish.
  if (generation === liveGeneration && (!live || live.at <= at)) live = { catalog, at }
  return catalog
}

/**
 * The published catalog, from the isolate's memo when it is recent enough.
 * `waitUntil` keeps a background refresh alive past the response.
 */
export function liveCatalog(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Catalog> {
  let age = live ? Date.now() - live.at : Infinity
  if (live && age < LIVE_FRESH_MS) return Promise.resolve(live.catalog)
  if (live && age < LIVE_MAX_AGE_MS) {
    if (!liveRefreshing) {
      liveRefreshing = true
      waitUntil(
        refreshLiveCatalog(db, bucket)
          .catch((error: unknown) => log('error', 'Live catalog refresh failed', errorFields(error)))
          .finally(() => {
            liveRefreshing = false
          }),
      )
    }
    return Promise.resolve(live.catalog)
  }
  return refreshLiveCatalog(db, bucket)
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

/** Makes version `n` live (publish) or live again (rollback). False if it can't go live. */
export async function publishVersion(db: D1DataTableDatabase, slug: string, n: number, now = Date.now()): Promise<boolean> {
  let published = await setLiveVersion(db, slug, n, now)
  forgetLiveCatalog()
  return published
}
