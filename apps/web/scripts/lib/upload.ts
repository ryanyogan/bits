// Builds a course folder from disk and saves it as the course's next
// version (R2 + D1), optionally publishing it. Shared by the CLI
// (scripts/content.ts) and the test platform, which publishes
// content/courses/ into its in-memory bindings.
import * as path from 'node:path'

import type { CourseVersion, D1DataTableDatabase } from '@bits/db'

import { buildCourse, type CourseBuild } from '../../app/content/compile/index.ts'
import { publishVersion, saveBuild } from '../../app/content/store.ts'
import { readCourseFolder } from './content-folder.ts'

export interface UploadResult {
  dir: string
  build: CourseBuild
  version: CourseVersion
  published: boolean
}

export async function uploadCourseFolder(
  db: D1DataTableDatabase,
  bucket: R2Bucket,
  dir: string,
  options: { source: string; userId?: string | null; publish?: boolean },
): Promise<UploadResult> {
  let build = buildCourse(await readCourseFolder(dir), { folder: path.basename(dir) })
  let version = await saveBuild(db, build, { source: options.source, userId: options.userId }, bucket)
  let published = options.publish && version.status === 'ready' ? await publishVersion(db, build.slug, version.n) : false
  return { dir, build, version, published }
}
