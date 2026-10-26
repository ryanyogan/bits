// Course content index (migration 0004, decision 018): courses, their built
// versions with validation reports, and who authors them. The compiled JSON
// itself lives in R2; the app's content store (apps/web/app/content/store.ts)
// writes and reads it.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { Course, CourseVersion, ReportItem, VersionStatus } from '../tables.ts'

type VersionRow = Omit<CourseVersion, 'report'> & { report: string }

const versionColumns = `v.id, v.course_slug, v.n, v.status, v.errors, v.warnings, v.report, v.files, v.source,
  v.created_by, v.created_at, v.published_at`

function toVersion(row: VersionRow): CourseVersion {
  let report: ReportItem[] = []
  try {
    let parsed: unknown = JSON.parse(row.report)
    if (Array.isArray(parsed)) report = parsed as ReportItem[]
  } catch {}
  return { ...row, report }
}

/** A live course: its slug and the version learners get. */
export interface LiveCourse {
  slug: string
  version_id: string
  n: number
  published_at: number | null
}

/** Every published course with its live version, in catalog order. */
export async function listLiveCourses(db: D1DataTableDatabase): Promise<LiveCourse[]> {
  let result = await db.d1
    .prepare(
      `select c.slug, v.id as version_id, v.n, v.published_at
       from courses c join course_versions v on v.id = c.current_version_id
       where v.status = 'ready'
       order by c.sort, c.slug`,
    )
    .all<LiveCourse>()
  return result.results
}

export async function findCourse(db: D1DataTableDatabase, slug: string): Promise<Course | null> {
  return db.d1.prepare('select * from courses where slug = ?').bind(slug).first<Course>()
}

/** Every build of a course, newest first. */
export async function listCourseVersions(db: D1DataTableDatabase, slug: string): Promise<CourseVersion[]> {
  let result = await db.d1
    .prepare(`select ${versionColumns} from course_versions v where v.course_slug = ? order by v.n desc`)
    .bind(slug)
    .all<VersionRow>()
  return result.results.map(toVersion)
}

export async function findCourseVersion(db: D1DataTableDatabase, slug: string, n: number): Promise<CourseVersion | null> {
  let row = await db.d1
    .prepare(`select ${versionColumns} from course_versions v where v.course_slug = ? and v.n = ?`)
    .bind(slug, n)
    .first<VersionRow>()
  return row ? toVersion(row) : null
}

/** Courses this user may manage: all of them for admins, else the ones they author. */
export async function listManagedCourses(db: D1DataTableDatabase, user: { id: string; role: string }): Promise<Course[]> {
  let statement =
    user.role === 'admin'
      ? db.d1.prepare('select * from courses order by sort, slug')
      : db.d1
          .prepare(
            `select c.* from courses c join course_authors a on a.course_slug = c.slug
             where a.user_id = ? order by c.sort, c.slug`,
          )
          .bind(user.id)
  return (await statement.all<Course>()).results
}

export async function listCourseAuthorIds(db: D1DataTableDatabase, slug: string): Promise<string[]> {
  let result = await db.d1
    .prepare('select user_id from course_authors where course_slug = ?')
    .bind(slug)
    .all<{ user_id: string }>()
  return result.results.map((row) => row.user_id)
}

export interface CourseBuildInput {
  /** The new version's id (crypto.randomUUID()). */
  id: string
  slug: string
  /** From course.md; the folder name when it doesn't parse. */
  title: string
  track: string | null
  sort: number
  errors: number
  warnings: number
  report: ReportItem[]
  files: number
  source: string
  /** The uploader. Null for the CLI without --as. */
  userId: string | null
  /**
   * May build any course: admins and the CLI (which has the database
   * anyway). Everyone else may only build a course they own or author, or
   * a new slug, which they then own.
   */
  trusted: boolean
  now: number
}

/**
 * Records a build as the course's next version (n = previous + 1, assigned
 * in SQL so concurrent builds can't collide), creating the course on its
 * first build. A clean build starts as `building` until its JSON is in R2
 * (markVersionReady); a build with errors is `failed` and stays a report.
 *
 * Ownership is decided inside the one batch (a D1 transaction), not by a
 * read before it: the course row's `owner_id` is set only by the insert
 * that creates it, and every later statement runs only when the uploader is
 * trusted, the owner or a listed author. So when two first uploads of a new
 * slug race, one creates and owns the course and the other writes nothing.
 * Returns null when the uploader may not build this course; no version is
 * left behind.
 */
export async function recordCourseBuild(db: D1DataTableDatabase, input: CourseBuildInput): Promise<CourseVersion | null> {
  let d1 = db.d1
  let status: VersionStatus = input.errors > 0 ? 'failed' : 'building'
  let trusted = input.trusted ? 1 : 0
  // ?S = slug, ?U = user id, ?T = trusted, against an existing courses row `c`.
  let allowed = (c: string, S: string, U: string, T: string) =>
    `(${T} or ${c}.owner_id = ${U} or exists (select 1 from course_authors a where a.course_slug = ${S} and a.user_id = ${U}))`
  let statements = [
    // A failed build may not know the real title or track; keep the old ones.
    d1
      .prepare(
        `insert into courses (slug, title, track, sort, owner_id, created_at, updated_at)
         values (?1, ?2, ?3, ?4, ?7, ?5, ?5)
         on conflict (slug) do update set
           title = case when ?6 then excluded.title else courses.title end,
           track = case when ?6 then excluded.track else courses.track end,
           sort = case when ?6 then excluded.sort else courses.sort end,
           updated_at = excluded.updated_at
         where ${allowed('courses', '?1', '?7', '?8')}`,
      )
      .bind(input.slug, input.title, input.track, input.sort, input.now, input.errors === 0 ? 1 : 0, input.userId, trusted),
    // The creator (owner_id) or a trusted uploader becomes an author.
    d1
      .prepare(
        `insert or ignore into course_authors (course_slug, user_id, created_at)
         select ?1, ?2, ?3 where ?2 is not null
           and exists (select 1 from courses c where c.slug = ?1 and (?4 or c.owner_id = ?2))`,
      )
      .bind(input.slug, input.userId, input.now, trusted),
    d1
      .prepare(
        `insert into course_versions
           (id, course_slug, n, status, errors, warnings, report, files, source, created_by, created_at)
         select ?1, ?2, (select coalesce(max(n), 0) + 1 from course_versions where course_slug = ?2),
           ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
         where exists (select 1 from courses c where c.slug = ?2 and ${allowed('c', '?2', '?9', '?11')})`,
      )
      .bind(
        input.id,
        input.slug,
        status,
        input.errors,
        input.warnings,
        JSON.stringify(input.report),
        input.files,
        input.source,
        input.userId,
        input.now,
        trusted,
      ),
  ]
  await db.batch(statements)
  let row = await d1.prepare(`select ${versionColumns} from course_versions v where v.id = ?`).bind(input.id).first<VersionRow>()
  // Fail closed: an untrusted uploader must be a listed author afterwards.
  let isAuthor = input.trusted || (input.userId !== null && (await listCourseAuthorIds(db, input.slug)).includes(input.userId))
  if (!isAuthor) {
    if (row) await deleteVersion(db, input.id)
    return null
  }
  return row ? toVersion(row) : null
}

/** The version's JSON is in R2: it may now be published. */
export async function markVersionReady(db: D1DataTableDatabase, versionId: string): Promise<void> {
  await db.d1.prepare(`update course_versions set status = 'ready' where id = ? and status = 'building'`).bind(versionId).run()
}

/** Drops a version whose R2 upload failed. */
export async function deleteVersion(db: D1DataTableDatabase, versionId: string): Promise<void> {
  await db.d1.prepare('delete from course_versions where id = ?').bind(versionId).run()
}

/**
 * Makes version `n` of the course live: the publish and rollback pointer
 * flip. Only a `ready` version of this course can go live. Returns false
 * when there is no such version.
 */
export async function setLiveVersion(db: D1DataTableDatabase, slug: string, n: number, now: number): Promise<boolean> {
  let version = await findCourseVersion(db, slug, n)
  if (!version || version.status !== 'ready') return false
  let [update] = await db.batch([
    db.d1
      .prepare('update courses set current_version_id = ?, updated_at = ? where slug = ?')
      .bind(version.id, now, slug),
    db.d1
      .prepare('update course_versions set published_at = coalesce(published_at, ?) where id = ?')
      .bind(now, version.id),
  ])
  return (update?.meta.changes ?? 0) > 0
}
