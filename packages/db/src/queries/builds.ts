// The build-check journal (migration 0015, decision 072): every call bits
// makes to a learner's deployed Worker for a `:::verify` block. Checks are
// signed-in only: an account costs a verified email under the daily mail
// cap, while a signed-out visitor id costs nothing to mint, so only
// accounts can spend the shared per-origin budget. A row is reserved before
// the fetch (the caps live in the insert) and finished after it. "Complete
// lesson" reads which blocks passed from here, never from the form, and a
// certificate reads the course's passing origin.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { BuildCheck, BuildOutcome } from '../tables.ts'

export interface BuildCheckInput {
  id: string
  userId: string
  courseId: string
  lessonSlug: string
  verifyId: string
  origin: string
  path: string
  now: number
}

export interface BuildCheckCaps {
  /** Rows created at or after this count toward the hourly caps. */
  hourSince: number
  /** Per user, every origin. */
  hour: number
  /** Per user, per target origin. */
  originHour: number
  /**
   * Every user together, per target origin: past this a user who hasn't
   * checked this origin within the hour is refused.
   */
  originSoftHour: number
  /**
   * Every user together, per target origin, with no exceptions: the most
   * calls any one Worker gets from bits in an hour.
   */
  originHardHour: number
}

/**
 * Reserves a `pending` check only while, within the last hour: the user's
 * checks, and the user's checks of this origin, stay under their caps; all
 * checks of this origin stay under the hard cap; and either the user already
 * checked this origin or all checks of it stay under the soft cap. One
 * `INSERT … SELECT … WHERE` statement, so parallel requests can't take the
 * same last slot. A user already checking is never locked out by others
 * until the hard cap, which bounds the calls (security review, 072).
 * Returns whether the row was written.
 */
export async function reserveBuildCheck(db: D1DataTableDatabase, input: BuildCheckInput, caps: BuildCheckCaps): Promise<boolean> {
  let result = await db.d1
    .prepare(
      `insert into build_checks (id, user_id, course_id, lesson_slug, verify_id, origin, path, outcome, created_at)
       select ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8
       where (select count(*) from build_checks where user_id = ?2 and created_at >= ?9) < ?10
         and (select count(*) from build_checks where user_id = ?2 and origin = ?6 and created_at >= ?9) < ?11
         and (select count(*) from build_checks where origin = ?6 and created_at >= ?9) < ?13
         and (
           exists (select 1 from build_checks where user_id = ?2 and origin = ?6 and created_at >= ?9)
           or (select count(*) from build_checks where origin = ?6 and created_at >= ?9) < ?12
         )`,
    )
    .bind(
      input.id,
      input.userId,
      input.courseId,
      input.lessonSlug,
      input.verifyId,
      input.origin,
      input.path,
      input.now,
      caps.hourSince,
      caps.hour,
      caps.originHour,
      caps.originSoftHour,
      caps.originHardHour,
    )
    .run()
  return result.meta.changes === 1
}

/** Records how a reserved check ended. */
export async function finishBuildCheck(
  db: D1DataTableDatabase,
  id: string,
  result: { outcome: Exclude<BuildOutcome, 'pending'>; status: number | null; durationMs: number },
): Promise<void> {
  await db.d1
    .prepare(`update build_checks set outcome = ?, status = ?, duration_ms = ? where id = ? and outcome = 'pending'`)
    .bind(result.outcome, result.status, Math.max(0, Math.round(result.durationMs)), id)
    .run()
}

/** Ids of the verify blocks in a lesson the user has a passing check for. */
export async function listPassedBuildChecks(
  db: D1DataTableDatabase,
  userId: string,
  lesson: { courseId: string; lessonSlug: string },
): Promise<string[]> {
  let result = await db.d1
    .prepare(
      `select distinct verify_id from build_checks
       where user_id = ? and course_id = ? and lesson_slug = ? and outcome = 'pass'`,
    )
    .bind(userId, lesson.courseId, lesson.lessonSlug)
    .all<{ verify_id: string }>()
  return result.results.map((row) => row.verify_id)
}

/** A passing check: where and when (the certificate's proof link). */
export interface PassedBuild {
  lesson_slug: string
  verify_id: string
  origin: string
  created_at: number
}

/** The user's newest passing check for each verify block of a course. */
export async function listCoursePassedBuilds(db: D1DataTableDatabase, userId: string, courseId: string): Promise<PassedBuild[]> {
  let result = await db.d1
    .prepare(
      `select lesson_slug, verify_id, origin, max(created_at) as created_at from build_checks
       where user_id = ? and course_id = ? and outcome = 'pass'
       group by lesson_slug, verify_id`,
    )
    .bind(userId, courseId)
    .all<PassedBuild>()
  return result.results
}

/** The user's build checks, newest first (the settings export). */
export async function listBuildChecks(db: D1DataTableDatabase, userId: string, limit = 500): Promise<BuildCheck[]> {
  let result = await db.d1
    .prepare(
      `select id, user_id, course_id, lesson_slug, verify_id, origin, path, outcome, status, duration_ms, created_at
       from build_checks where user_id = ? order by created_at desc, rowid desc limit ?`,
    )
    .bind(userId, limit)
    .all<BuildCheck>()
  return result.results
}
