// POST /api/author/upload: a course folder from the /author DropZone (or a
// plain multipart form). Each folder with a course.md is built and saved as
// that course's next version, valid or not, so its report shows on
// /author/:course. Nothing goes live until the author publishes.
//
// Fields: `files` (repeated; text files with their folder-relative path as
// the file name) and `assets` (repeated; paths of media the DropZone didn't
// send, so the build can check a lesson's video exists). Zips are not
// unpacked yet.
import { listCourseAuthorIds, findCourse } from '@bits/db'
import { redirect } from 'remix/response/redirect'
import type { RequestContext } from 'remix/router'

import { canAuthor, currentUser } from '../../auth/identity.ts'
import type { SourceFile } from '../../content/compile/index.ts'
import { contentBucket } from '../../content/request.ts'
import { saveBuild } from '../../content/store.ts'
import { getDatabase } from '../../middleware/database.ts'
import { routes } from '../../routes.ts'
import { canManageCourse } from '../author/data.ts'

/** Files the build reads as text. */
const TEXT_FILES = /\.(md|vtt|txt)$/i
const MAX_COURSES = 10

interface UploadedCourse {
  slug: string
  version: number
  errors: number
  warnings: number
  href: string
}

export async function authorUpload(context: RequestContext<any, any>): Promise<Response> {
  let user = currentUser(context)
  if (!user) return json({ error: 'sign_in_required' }, 401)
  if (!canAuthor(user)) return json({ error: 'forbidden', message: 'Writing courses is invite-only for now.' }, 403)

  let formData = context.get(FormData) as FormData
  let sources: SourceFile[] = []
  for (let value of formData.getAll('files')) {
    if (typeof value === 'string') continue
    let path = cleanPath(value.name)
    if (!path) continue
    if (/\.zip$/i.test(path)) {
      return json({ error: 'zip_not_supported', message: 'Zip uploads aren’t unpacked yet. Drop the course folder instead.' }, 422)
    }
    sources.push(TEXT_FILES.test(path) ? { path, size: value.size, text: await value.text() } : { path, size: value.size })
  }
  for (let value of formData.getAll('assets')) {
    let path = typeof value === 'string' ? cleanPath(value) : undefined
    if (path) sources.push({ path, size: 0 })
  }

  let roots = courseRoots(sources)
  if (!roots.length) {
    return json({ error: 'no_course', message: 'No course.md found. Drop a course folder (one with a course.md in it).' }, 422)
  }
  if (roots.length > MAX_COURSES) return json({ error: 'too_many_courses', message: `Upload at most ${MAX_COURSES} courses at once.` }, 422)

  let db = getDatabase(context)
  // The compiler (markdown, YAML) loads on the first upload, not with every
  // isolate (decision 026).
  let { buildCourse } = await import('../../content/compile/index.ts')
  let builds = roots.map((root) => {
    let prefix = root ? `${root}/` : ''
    // A file belongs to the deepest course folder that holds it.
    let files = sources
      .filter((file) => file.path.startsWith(prefix))
      .filter((file) => !roots.some((other) => other.length > root.length && file.path.startsWith(`${other}/`)))
      .map((file) => ({ ...file, path: file.path.slice(prefix.length) }))
    return buildCourse(files, { folder: root.split('/').pop() || 'course' })
  })

  // Check every course before saving any: an author may only rebuild their
  // own. This early check keeps a mixed upload from half-saving; the claim
  // itself is atomic in recordCourseBuild, which also catches a race.
  for (let build of builds) {
    let existing = await findCourse(db, build.slug)
    if (existing && !canManageCourse(user, { ownerIds: await listCourseAuthorIds(db, build.slug) })) {
      return json({ error: 'forbidden', message: `“${build.slug}” belongs to another author.` }, 403)
    }
  }

  let courses: UploadedCourse[] = []
  for (let build of builds) {
    let version = await saveBuild(db, build, { source: 'folder upload', userId: user.id, trusted: user.role === 'admin' }, contentBucket())
    if (!version) return json({ error: 'forbidden', message: `“${build.slug}” belongs to another author.` }, 403)
    courses.push({
      slug: build.slug,
      version: version.n,
      errors: build.errors,
      warnings: build.warnings,
      href: routes.author.course.index.href({ course: build.slug }),
    })
  }

  // A plain form post (no JS) lands on the first course's build page.
  if (context.request.headers.get('Accept')?.includes('text/html')) return redirect(courses[0]!.href, 303)
  return json({ courses }, 201)
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** A safe folder-relative path, or undefined. Dot segments and dotfiles are dropped. */
function cleanPath(name: string): string | undefined {
  let parts = name.replace(/\\/g, '/').split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part.startsWith('.'))) return undefined
  return parts.join('/')
}

/** Folders that hold a course.md ('' when it sits at the top of the upload). */
function courseRoots(files: SourceFile[]): string[] {
  return files
    .filter((file) => /(^|\/)course\.md$/i.test(file.path))
    .map((file) => file.path.replace(/\/?course\.md$/i, ''))
    .sort()
}
