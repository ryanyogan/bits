// Builds a course folder from disk and saves it as the course's next
// version (R2 + D1), optionally publishing it. Shared by the CLI
// (scripts/content.ts) and the test platform, which publishes
// content/courses/ into its in-memory bindings.
//
// A build whose output matches the course's newest version is not saved
// again (decision 036): CI uploads every course on every push, and only the
// ones that changed get a version.
import * as path from 'node:path'

import { listNewestVersions, type CourseVersion, type D1DataTableDatabase, type NewestVersion } from '@bits/db'

import { buildCourse, type CourseBuild } from '../../app/content/compile/index.ts'
import { buildHash, publishVersion, readBuildHash, saveBuild } from '../../app/content/store.ts'
import { loadVideoLinks, type VideoLinks } from '../../app/video/link.ts'
import { readCourseFolder } from './content-folder.ts'

/**
 * - `created`: saved as a new version (published too, with `publish`).
 * - `unchanged`: the newest version holds this exact build; nothing saved.
 *   With `publish`, it is published if it never was.
 * - `rolled-back`: the newest version holds this build, but it was live
 *   once and someone rolled back from it. Left alone: the rollback stands
 *   until the course changes.
 */
export type UploadOutcome = 'created' | 'unchanged' | 'rolled-back'

export interface UploadResult {
  dir: string
  build: CourseBuild
  version: Pick<CourseVersion, 'id' | 'n' | 'status'>
  outcome: UploadOutcome
  /** Made live by this upload. */
  published: boolean
  /** Live after this upload. */
  live: boolean
}

/** What every upload in a run reads from D1 first, once: two queries, in parallel. */
export interface UploadState {
  videos: VideoLinks
  newest: Map<string, NewestVersion>
}

export async function readUploadState(db: D1DataTableDatabase): Promise<UploadState> {
  // Lessons link to videos already uploaded and ready (decision 029).
  let [videos, newest] = await Promise.all([loadVideoLinks(db), listNewestVersions(db)])
  return { videos, newest }
}

export interface UploadOptions {
  source: string
  userId?: string | null
  publish?: boolean
  /** Save a new version even when the newest one holds the same build. */
  force?: boolean
  /** From readUploadState; read here when absent. */
  state?: UploadState
}

export async function uploadCourseFolder(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  dir: string,
  options: UploadOptions,
): Promise<UploadResult> {
  let state = options.state ?? (await readUploadState(db))
  let build = buildCourse(await readCourseFolder(dir), { folder: path.basename(dir), videos: state.videos })

  let newest = state.newest.get(build.slug)
  if (!options.force && newest?.status === 'ready' && !build.errors) {
    // One R2 head: the hash saved with the newest version's manifest.
    let [hash, saved] = await Promise.all([buildHash(build), readBuildHash(bucket, build.slug, newest.n)])
    if (hash && hash === saved) {
      let version = { id: newest.id, n: newest.n, status: newest.status }
      if (newest.live) return { dir, build, version, outcome: 'unchanged', published: false, live: true }
      if (newest.published_at !== null) return { dir, build, version, outcome: 'rolled-back', published: false, live: false }
      let published = options.publish ? await publishVersion(db, bucket, build.slug, newest.n) : false
      return { dir, build, version, outcome: 'unchanged', published, live: published }
    }
  }

  // The CLI and the test platform hold the database already: trusted.
  let version = await saveBuild(db, build, { source: options.source, userId: options.userId, trusted: true }, bucket)
  if (!version) throw new Error(`${build.slug}: the build was not recorded`)
  let published = options.publish && version.status === 'ready' ? await publishVersion(db, bucket, build.slug, version.n) : false
  // Later folders in the same run compare against this version.
  state.newest.set(build.slug, {
    slug: build.slug,
    id: version.id,
    n: version.n,
    status: version.status,
    published_at: published ? Date.now() : null,
    live: published,
  })
  return { dir, build, version, outcome: 'created', published, live: published }
}
