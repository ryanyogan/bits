// The build-check journal (migration 0015, decision 072): every call bits
// makes to a learner's deployed Worker for a `:::verify` block. A row is
// reserved before the fetch (the caps live in the insert) and finished
// after it. "Complete lesson" reads which blocks passed from here, never
// from the form, and a certificate reads the course's passing origin.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { BuildCheck, BuildOutcome } from '../tables.ts'
import type { RunOwner } from './runs.ts'

function ownerColumn(owner: RunOwner): [column: 'user_id' | 'visitor', value: string] {
  return owner.userId ? ['user_id', owner.userId] : ['visitor', owner.visitor!]
}

export interface BuildCheckInput {
  id: string
  owner: RunOwner
  ipHash: string | null
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
  /** Per owner (user or visitor). */
  hour: number
  /** Signed out, per IP. */
  ipHour: number
  /** Per target origin, everyone together. */
  originHour: number
}

/**
 * Reserves a `pending` check only while the owner's checks in the last hour,
 * (signed out) the IP's, and everyone's against this origin stay under their
 * caps: one `INSERT … SELECT … WHERE` statement, so parallel requests can't
 * take the same last slot. Returns whether the row was written.
 */
export async function reserveBuildCheck(db: D1DataTableDatabase, input: BuildCheckInput, caps: BuildCheckCaps): Promise<boolean> {
  let [column, bind] = ownerColumn(input.owner)
  let result = await db.d1
    .prepare(
      `insert into build_checks (id, user_id, visitor, ip_hash, course_id, lesson_slug, verify_id, origin, path, outcome, created_at)
       select ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10
       where (select count(*) from build_checks where ${column} = ?11 and created_at >= ?12) < ?13
         and (?4 is null or (select count(*) from build_checks where ip_hash = ?4 and user_id is null and created_at >= ?12) < ?14)
         and (select count(*) from build_checks where origin = ?8 and created_at >= ?12) < ?15`,
    )
    .bind(
      input.id,
      input.owner.userId ?? null,
      input.owner.visitor ?? null,
      input.ipHash,
      input.courseId,
      input.lessonSlug,
      input.verifyId,
      input.origin,
      input.path,
      input.now,
      bind,
      caps.hourSince,
      caps.hour,
      caps.ipHour,
      caps.originHour,
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

/** Ids of the verify blocks in a lesson the owner has a passing check for. */
export async function listPassedBuildChecks(
  db: D1DataTableDatabase,
  owner: RunOwner,
  lesson: { courseId: string; lessonSlug: string },
): Promise<string[]> {
  let [column, bind] = ownerColumn(owner)
  let result = await db.d1
    .prepare(
      `select distinct verify_id from build_checks
       where ${column} = ? and course_id = ? and lesson_slug = ? and outcome = 'pass'`,
    )
    .bind(bind, lesson.courseId, lesson.lessonSlug)
    .all<{ verify_id: string }>()
  return result.results.map((row) => row.verify_id)
}

/** At sign-in: the visitor's signed-out checks join the account's journal. */
export async function claimVisitorBuildChecks(db: D1DataTableDatabase, visitor: string, userId: string): Promise<void> {
  await db.d1.prepare('update build_checks set user_id = ? where visitor = ? and user_id is null').bind(userId, visitor).run()
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
      `select id, user_id, visitor, ip_hash, course_id, lesson_slug, verify_id, origin, path, outcome, status, duration_ms, created_at
       from build_checks where user_id = ? order by created_at desc, rowid desc limit ?`,
    )
    .bind(userId, limit)
    .all<BuildCheck>()
  return result.results
}
