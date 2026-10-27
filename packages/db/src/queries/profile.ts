// Profile and certificate reads in one D1 batch (decision 035).
//
// A profile is six reads about one user: completed lessons, the latest
// journal entries, the journal size, badges, activity days and linked
// sign-in methods. They run as one `db.batch`, one binding call and one
// round trip, and the same statements can join the session read
// (`readSessionWithUser({ profile })`) so `/me` is a single round trip.
//
// Every statement names its user through a `UserRef`: a SQL expression for
// the user id and the values of its `?n` placeholders. That lets one set of
// statements serve a known id, a public handle, or the session's user.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { D1PreparedStatement, D1Result } from '../d1/types.ts'
import type { ExerciseAttempt, User } from '../tables.ts'
import type { IdentityRow } from './auth.ts'
import type { CompletedLesson } from './progress.ts'
import { userFromRawRow } from './users.ts'

/** A user id as SQL: `sql` uses placeholders `?1`…`?n` bound to `params`. */
export interface UserRef {
  sql: string
  params: unknown[]
}

/** Journal entries a profile reads (the full journal tab shows them all). */
export const PROFILE_JOURNAL_LIMIT = 50

export interface ProfileRows {
  completed: CompletedLesson[]
  /** The newest `PROFILE_JOURNAL_LIMIT` journal entries, newest first. */
  attempts: ExerciseAttempt[]
  /** All journal entries. */
  promptsWritten: number
  badges: { badge_id: string; awarded_at: number }[]
  /** Activity days from `activitySince` on, oldest first. */
  activity: { day: string; xp: number; actions: number }[]
  identities: IdentityRow[]
}

export interface ProfileOptions {
  /** First activity day to read (YYYY-MM-DD, inclusive). */
  activitySince: string
}

/** The six profile statements for `user`, in the order `profileRowsFrom` reads them. */
export function profileStatements(db: D1DataTableDatabase, user: UserRef, options: ProfileOptions): D1PreparedStatement[] {
  // A statement's own value (the limit, the first day) comes after the user's.
  let own = `?${user.params.length + 1}`
  let statement = (sql: string, ...extra: unknown[]) => db.d1.prepare(sql).bind(...user.params, ...extra)
  return [
    // Same columns and order as listCompletedLessons.
    statement(
      `select course_id, lesson_slug, completed_at from lesson_progress
       where user_id = ${user.sql} and completed_at is not null
       order by completed_at desc`,
    ),
    // Same columns and order as listAttempts.
    statement(
      `select id, user_id, visitor, ip_hash, course_id, lesson_slug, exercise_id, prompt, source, temperature,
              output, model, input_tokens, output_tokens, passed, created_at
       from exercise_attempts where user_id = ${user.sql} order by created_at desc, rowid desc limit ${own}`,
      PROFILE_JOURNAL_LIMIT,
    ),
    statement(`select count(*) as n from exercise_attempts where user_id = ${user.sql}`),
    statement(`select badge_id, awarded_at from user_badges where user_id = ${user.sql} order by awarded_at`),
    statement(
      `select day, xp, actions from activity_days where user_id = ${user.sql} and day >= ${own} order by day`,
      options.activitySince,
    ),
    statement(`select * from identities where user_id = ${user.sql} order by created_at`),
  ]
}

/** Reads the results of `profileStatements`, in order. */
export function profileRowsFrom(results: D1Result<Record<string, unknown>>[]): ProfileRows {
  let [completed, attempts, count, badges, activity, identities] = results.map((result) => result?.results ?? [])
  return {
    completed: completed as unknown as CompletedLesson[],
    attempts: (attempts as (Omit<ExerciseAttempt, 'passed'> & { passed: number | null })[]).map((row) => ({
      ...row,
      passed: row.passed === null ? null : row.passed === 1,
    })),
    promptsWritten: Number((count?.[0] as { n?: number } | undefined)?.n ?? 0),
    badges: badges as unknown as ProfileRows['badges'],
    activity: activity as unknown as ProfileRows['activity'],
    identities: identities as unknown as IdentityRow[],
  }
}

/** A user's profile rows, in one batch. */
export async function readProfileRows(db: D1DataTableDatabase, userId: string, options: ProfileOptions): Promise<ProfileRows> {
  return profileRowsFrom(await db.batch(profileStatements(db, { sql: '?1', params: [userId] }, options)))
}

/**
 * A public profile by handle, with its rows, in one batch. Null for an
 * unknown or private handle; a private user's rows are never read.
 */
export async function readPublicProfile(
  db: D1DataTableDatabase,
  handle: string,
  options: ProfileOptions,
): Promise<{ user: User; rows: ProfileRows } | null> {
  let key = handle.toLowerCase()
  let publicUser: UserRef = { sql: '(select id from users where handle = ?1 and is_public = 1)', params: [key] }
  let [users, ...rest] = await db.batch([
    db.d1.prepare('select * from users where handle = ?1 and is_public = 1').bind(key),
    ...profileStatements(db, publicUser, options),
  ])
  let row = users?.results[0]
  return row ? { user: userFromRawRow(row), rows: profileRowsFrom(rest) } : null
}

/**
 * A user by handle with their completed lessons (newest first), in one
 * batch. For certificates, which check visibility themselves.
 */
export async function readUserWithCompleted(
  db: D1DataTableDatabase,
  handle: string,
): Promise<{ user: User; completed: CompletedLesson[] } | null> {
  let key = handle.toLowerCase()
  let [users, completed] = await db.batch([
    db.d1.prepare('select * from users where handle = ?1').bind(key),
    db.d1
      .prepare(
        `select course_id, lesson_slug, completed_at from lesson_progress
         where user_id = (select id from users where handle = ?1) and completed_at is not null
         order by completed_at desc`,
      )
      .bind(key),
  ])
  let row = users?.results[0]
  return row ? { user: userFromRawRow(row), completed: (completed?.results ?? []) as unknown as CompletedLesson[] } : null
}
