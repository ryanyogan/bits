// The ask journal (migration 0011, decision 052): every answer to an
// `:::ask` quick check, graded on the server. "Complete lesson" reads which
// asks were answered right from here, never from the form.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { AskAttempt, XpKind } from '../tables.ts'
import type { RunOwner } from './runs.ts'

function ownerColumn(owner: RunOwner): [column: 'user_id' | 'visitor', value: string] {
  return owner.userId ? ['user_id', owner.userId] : ['visitor', owner.visitor!]
}

export interface AskAttemptInput {
  id: string
  owner: RunOwner
  ipHash: string | null
  courseId: string
  lessonSlug: string
  askId: string
  answer: string
  correct: boolean
  now: number
}

/** Longest answer kept (the migration's CHECK). */
export const MAX_JOURNAL_ANSWER = 500

/**
 * Journals an answer only while the owner's answers in the last hour, and
 * (signed out) the IP's, stay under their caps: one `INSERT … SELECT …
 * WHERE count < cap` statement, so parallel requests can't pass the same
 * last slot. Returns whether the row was written.
 */
export async function insertAskWithin(
  db: D1DataTableDatabase,
  input: AskAttemptInput,
  caps: { hourSince: number; hour: number; ipHour: number },
): Promise<boolean> {
  let [column, bind] = ownerColumn(input.owner)
  let result = await db.d1
    .prepare(
      `insert into ask_attempts (id, user_id, visitor, ip_hash, course_id, lesson_slug, ask_id, answer, correct, created_at)
       select ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
       where (select count(*) from ask_attempts where ${column} = ?11 and created_at >= ?12) < ?13
         and (?4 is null or (select count(*) from ask_attempts where ip_hash = ?4 and user_id is null and created_at >= ?12) < ?14)`,
    )
    .bind(
      input.id,
      input.owner.userId ?? null,
      input.owner.visitor ?? null,
      input.ipHash,
      input.courseId,
      input.lessonSlug,
      input.askId,
      input.answer.slice(0, MAX_JOURNAL_ANSWER),
      input.correct ? 1 : 0,
      input.now,
      bind,
      caps.hourSince,
      caps.hour,
      caps.ipHour,
    )
    .run()
  return result.meta.changes === 1
}

/** Ids of the asks in a lesson the owner has answered right at least once. */
export async function listRightAsks(
  db: D1DataTableDatabase,
  owner: RunOwner,
  lesson: { courseId: string; lessonSlug: string },
): Promise<string[]> {
  let [column, bind] = ownerColumn(owner)
  let result = await db.d1
    .prepare(
      `select distinct ask_id from ask_attempts
       where ${column} = ? and course_id = ? and lesson_slug = ? and correct = 1`,
    )
    .bind(bind, lesson.courseId, lesson.lessonSlug)
    .all<{ ask_id: string }>()
  return result.results.map((row) => row.ask_id)
}

/** At sign-in: the visitor's signed-out answers join the account's journal. */
export async function claimVisitorAsks(db: D1DataTableDatabase, visitor: string, userId: string): Promise<void> {
  await db.d1.prepare('update ask_attempts set user_id = ? where visitor = ? and user_id is null').bind(userId, visitor).run()
}

export interface AskAwardInput {
  id: string
  userId: string
  kind: XpKind
  /** course/lesson/ask */
  ref: string
  xp: number
  /** The user's local day (YYYY-MM-DD). */
  day: string
  now: number
}

/**
 * Awards a right answer's xp once (`insert or ignore` on the ledger's
 * UNIQUE(user_id, kind, ref)), then recomputes the day's xp and the user's
 * total from the ledger, in one batch. Returns whether the award is new.
 */
export async function recordAskAward(db: D1DataTableDatabase, input: AskAwardInput): Promise<boolean> {
  let d1 = db.d1
  let [award] = await db.batch([
    d1
      .prepare(`insert or ignore into xp_events (id, user_id, kind, ref, xp, day, created_at) values (?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.id, input.userId, input.kind, input.ref, input.xp, input.day, input.now),
    d1
      .prepare(
        `insert into activity_days (user_id, day, xp, actions)
         values (?1, ?2, (select coalesce(sum(xp), 0) from xp_events where user_id = ?1 and day = ?2), 1)
         on conflict (user_id, day) do update set xp = excluded.xp`,
      )
      .bind(input.userId, input.day),
    d1
      .prepare(`update users set xp_total = (select coalesce(sum(xp), 0) from xp_events where user_id = ?1), updated_at = ?2 where id = ?1`)
      .bind(input.userId, input.now),
  ])
  return award?.meta.changes === 1
}

/** The user's answers, newest first (the settings export). */
export async function listAskAttempts(db: D1DataTableDatabase, userId: string, limit = 500): Promise<AskAttempt[]> {
  let result = await db.d1
    .prepare(
      `select id, user_id, visitor, ip_hash, course_id, lesson_slug, ask_id, answer, correct, created_at
       from ask_attempts where user_id = ? order by created_at desc, rowid desc limit ?`,
    )
    .bind(userId, limit)
    .all<Omit<AskAttempt, 'correct'> & { correct: number }>()
  return result.results.map((row) => ({ ...row, correct: row.correct === 1 }))
}
