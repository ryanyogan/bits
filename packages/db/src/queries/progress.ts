// Lesson progress, the XP ledger, streaks, activity days, badges and the
// prompt journal (migration 0003, decision 016).
//
// Writes are one D1 batch (atomic; D1 has no interactive transactions) built
// from idempotent statements: awards are `insert or ignore` against
// UNIQUE(user_id, kind, ref) and xp_total is recomputed from the ledger, so a
// replayed completion or an anonymous merge never double-counts.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { ExerciseAttempt, XpKind } from '../tables.ts'

export interface AttemptInput {
  id: string
  exerciseId: string
  prompt: string
  passed: boolean
}

export interface AwardInput {
  id: string
  kind: XpKind
  /** course/lesson[/exercise] */
  ref: string
  xp: number
}

export interface LessonCompletionInput {
  userId: string
  courseId: string
  lessonSlug: string
  attempts: AttemptInput[]
  awards: AwardInput[]
  /** The user's local day (YYYY-MM-DD) and the day before it. */
  day: string
  yesterday: string
  now: number
}

/**
 * Records a completed lesson: progress row, journal attempts, once-only XP
 * awards, the day's activity, the recomputed xp_total and the streak.
 */
export async function recordLessonCompletion(db: D1DataTableDatabase, input: LessonCompletionInput): Promise<void> {
  await db.batch(lessonCompletionStatements(db, input))
}

/**
 * The statements recordLessonCompletion runs, so several completions (the
 * anonymous merge at sign-in) can go in one batch. They run in order, so
 * completions given oldest first build the streak day by day.
 */
export function lessonCompletionStatements(db: D1DataTableDatabase, input: LessonCompletionInput) {
  let { userId, courseId, lessonSlug, day, yesterday, now } = input
  let d1 = db.d1
  // The streak after today's activity: same day keeps it, the day after
  // extends it, a gap restarts it. Days compare as YYYY-MM-DD text.
  let nextStreak = `case
      when streak_last_day >= ?2 then streak_days
      when streak_last_day = ?3 then streak_days + 1
      else 1 end`

  return [
    d1
      .prepare(
        `insert into lesson_progress (user_id, course_id, lesson_slug, started_at, completed_at, updated_at)
         values (?1, ?2, ?3, ?4, ?4, ?4)
         on conflict (user_id, course_id, lesson_slug) do update set
           completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at),
           updated_at = excluded.updated_at`,
      )
      .bind(userId, courseId, lessonSlug, now),
    ...input.attempts.map((attempt) =>
      d1
        .prepare(
          `insert into exercise_attempts
             (id, user_id, course_id, lesson_slug, exercise_id, prompt, source, passed, created_at)
           values (?, ?, ?, ?, ?, ?, 'submit', ?, ?)`,
        )
        .bind(attempt.id, userId, courseId, lessonSlug, attempt.exerciseId, attempt.prompt, attempt.passed ? 1 : 0, now),
    ),
    ...input.awards.map((award) =>
      d1
        .prepare(
          `insert or ignore into xp_events (id, user_id, kind, ref, xp, day, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(award.id, userId, award.kind, award.ref, award.xp, day, now),
    ),
    d1
      .prepare(
        `insert into activity_days (user_id, day, xp, actions)
         values (?1, ?2, (select coalesce(sum(xp), 0) from xp_events where user_id = ?1 and day = ?2), 1)
         on conflict (user_id, day) do update set
           xp = excluded.xp,
           actions = activity_days.actions + 1`,
      )
      .bind(userId, day),
    d1
      .prepare(
        `update users set
           xp_total = (select coalesce(sum(xp), 0) from xp_events where user_id = ?1),
           streak_days = ${nextStreak},
           best_streak = max(best_streak, ${nextStreak}),
           streak_last_day = max(coalesce(streak_last_day, ''), ?2),
           updated_at = ?4
         where id = ?1`,
      )
      .bind(userId, day, yesterday, now),
  ]
}

export interface CompletedLesson {
  course_id: string
  lesson_slug: string
  completed_at: number
}

/** Every lesson the user has completed, newest first. */
export async function listCompletedLessons(db: D1DataTableDatabase, userId: string): Promise<CompletedLesson[]> {
  let result = await db.d1
    .prepare(
      `select course_id, lesson_slug, completed_at from lesson_progress
       where user_id = ? and completed_at is not null
       order by completed_at desc`,
    )
    .bind(userId)
    .all<CompletedLesson>()
  return result.results
}

/** Refs (course/lesson/exercise) of every exercise the user earned XP for. */
export async function listPassedExercises(db: D1DataTableDatabase, userId: string): Promise<string[]> {
  let result = await db.d1
    .prepare(`select ref from xp_events where user_id = ? and kind = 'exercise'`)
    .bind(userId)
    .all<{ ref: string }>()
  return result.results.map((row) => row.ref)
}

/** Records badges whose rules just became true. Already-held badges are ignored. */
export async function awardBadges(db: D1DataTableDatabase, userId: string, badgeIds: string[], now: number) {
  if (badgeIds.length === 0) return
  await db.batch(
    badgeIds.map((badgeId) =>
      db.d1
        .prepare('insert or ignore into user_badges (user_id, badge_id, awarded_at) values (?, ?, ?)')
        .bind(userId, badgeId, now),
    ),
  )
}

export async function listUserBadges(db: D1DataTableDatabase, userId: string) {
  let result = await db.d1
    .prepare('select badge_id, awarded_at from user_badges where user_id = ? order by awarded_at')
    .bind(userId)
    .all<{ badge_id: string; awarded_at: number }>()
  return result.results
}

/** Activity rows from `sinceDay` (YYYY-MM-DD, inclusive) on, oldest first. */
export async function listActivityDays(db: D1DataTableDatabase, userId: string, sinceDay: string) {
  let result = await db.d1
    .prepare('select day, xp, actions from activity_days where user_id = ? and day >= ? order by day')
    .bind(userId, sinceDay)
    .all<{ day: string; xp: number; actions: number }>()
  return result.results
}

/** The prompt journal (runs and submissions), newest first. */
export async function listAttempts(db: D1DataTableDatabase, userId: string, limit = 50): Promise<ExerciseAttempt[]> {
  let result = await db.d1
    .prepare(
      `select id, user_id, visitor, ip_hash, course_id, lesson_slug, exercise_id, prompt, source, temperature,
              output, model, input_tokens, output_tokens, passed, created_at
       from exercise_attempts where user_id = ? order by created_at desc, rowid desc limit ?`,
    )
    .bind(userId, limit)
    .all<Omit<ExerciseAttempt, 'passed'> & { passed: number | null }>()
  return result.results.map((row) => ({ ...row, passed: row.passed === null ? null : row.passed === 1 }))
}

export async function countAttempts(db: D1DataTableDatabase, userId: string): Promise<number> {
  let row = await db.d1
    .prepare('select count(*) as n from exercise_attempts where user_id = ?')
    .bind(userId)
    .first<{ n: number }>()
  return row?.n ?? 0
}
