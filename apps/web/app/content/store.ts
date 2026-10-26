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

/** Forgets every memoised version (tests). */
export function clearContentMemo() {
  memo.clear()
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
  now?: number
}

/**
 * Records a build as the course's next version. D1 assigns n first, so a
 * clean build's JSON goes to R2 under a v{n} prefix nothing else writes;
 * then the version is marked ready. A build with errors is a report only.
 */
export async function saveBuild(
  db: D1DataTableDatabase,
  build: CourseBuild,
  options: SaveOptions,
  bucket: R2Bucket,
): Promise<CourseVersion> {
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
    now: options.now ?? Date.now(),
  })
  if (version.status === 'failed' || !build.manifest || !build.lessons) return version

  let put = (key: string, value: unknown) =>
    bucket.put(key, JSON.stringify(value), {
      httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' },
    })
  try {
    await Promise.all([...build.lessons].map(([lesson, content]) => put(lessonKey(build.slug, version.n, lesson), content)))
    // The manifest last: a version whose manifest exists is complete.
    await put(manifestKey(build.slug, version.n), build.manifest)
    await markVersionReady(db, version.id)
  } catch (error) {
    await deleteVersion(db, version.id)
    throw error
  }
  return { ...version, status: 'ready' }
}

/** Makes version `n` live (publish) or live again (rollback). False if it can't go live. */
export function publishVersion(db: D1DataTableDatabase, slug: string, n: number, now = Date.now()): Promise<boolean> {
  return setLiveVersion(db, slug, n, now)
}
