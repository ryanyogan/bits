// Prompt runs: the journal rows POST /api/run writes (migration 0005,
// decision 019). Runs are counted for the run limits and for an exercise's
// `- run temperature=[...]` requirement, so the server never trusts the
// browser's claim that it ran.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { AttemptSource } from '../tables.ts'

/** Whose runs: the signed-in user, else the session's visitor id. */
export type RunOwner = { userId: string; visitor?: string | null } | { userId?: null; visitor: string }

/** Rows that are runs (not "Complete lesson" submissions). */
const RUNS = `source != 'submit'`

function ownerColumn(owner: RunOwner): [column: 'user_id' | 'visitor', value: string] {
  return owner.userId ? ['user_id', owner.userId] : ['visitor', owner.visitor!]
}

export interface RunCounts {
  /** The owner's runs since `hourSince`. */
  hour: number
  /** The owner's runs since `daySince`. */
  day: number
  /** Signed-out runs from this IP since `hourSince` (0 when no ipHash). */
  ipHour: number
  /** Live (model) runs by everyone since `todaySince`: the spend guard. */
  liveToday: number
}

export async function countRuns(
  db: D1DataTableDatabase,
  owner: RunOwner,
  ipHash: string | null,
  windows: { hourSince: number; daySince: number; todaySince: number },
): Promise<RunCounts> {
  let [column, bind] = ownerColumn(owner)
  let row = await db.d1
    .prepare(
      `select
         (select count(*) from exercise_attempts where ${column} = ?1 and ${RUNS} and created_at >= ?2) as hour,
         (select count(*) from exercise_attempts where ${column} = ?1 and ${RUNS} and created_at >= ?3) as day,
         (select count(*) from exercise_attempts where ip_hash = ?4 and user_id is null and created_at >= ?2) as ipHour,
         (select count(*) from exercise_attempts where source = 'live' and created_at >= ?5) as liveToday`,
    )
    .bind(bind, windows.hourSince, windows.daySince, ipHash, windows.todaySince)
    .first<RunCounts>()
  return { hour: row?.hour ?? 0, day: row?.day ?? 0, ipHour: row?.ipHour ?? 0, liveToday: row?.liveToday ?? 0 }
}

export interface RunInput {
  id: string
  owner: RunOwner
  ipHash: string | null
  courseId: string
  lessonSlug: string
  exerciseId: string
  prompt: string
  source: Exclude<AttemptSource, 'submit'>
  /** T × 100. */
  temperature: number
  /** Known up front for canned output; a live run fills it in with finishRun. */
  output: string
  model: string | null
  now: number
}

/** Longest output kept in the journal. */
export const MAX_JOURNAL_OUTPUT = 2000

export async function insertRun(db: D1DataTableDatabase, input: RunInput): Promise<void> {
  await db.d1
    .prepare(
      `insert into exercise_attempts
         (id, user_id, visitor, ip_hash, course_id, lesson_slug, exercise_id, prompt, source, temperature, output, model, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.owner.userId ?? null,
      input.owner.visitor ?? null,
      input.ipHash,
      input.courseId,
      input.lessonSlug,
      input.exerciseId,
      input.prompt,
      input.source,
      input.temperature,
      input.output.slice(0, MAX_JOURNAL_OUTPUT),
      input.model,
      input.now,
    )
    .run()
}

/** Saves a live run's streamed output and token counts once it ends. */
export async function finishRun(
  db: D1DataTableDatabase,
  id: string,
  result: { output: string; inputTokens: number; outputTokens: number },
): Promise<void> {
  await db.d1
    .prepare('update exercise_attempts set output = ?, input_tokens = ?, output_tokens = ? where id = ?')
    .bind(result.output.slice(0, MAX_JOURNAL_OUTPUT), result.inputTokens, result.outputTokens, id)
    .run()
}

/** Temperatures (× 100) the owner has run an exercise at, of any source. */
export async function listRunTemperatures(
  db: D1DataTableDatabase,
  owner: RunOwner,
  exercise: { courseId: string; lessonSlug: string; exerciseId: string },
): Promise<number[]> {
  let [column, bind] = ownerColumn(owner)
  let result = await db.d1
    .prepare(
      `select distinct temperature from exercise_attempts
       where ${column} = ? and ${RUNS} and course_id = ? and lesson_slug = ? and exercise_id = ?`,
    )
    .bind(bind, exercise.courseId, exercise.lessonSlug, exercise.exerciseId)
    .all<{ temperature: number }>()
  return result.results.map((row) => row.temperature)
}

/** At sign-in: the visitor's signed-out runs join the account's journal. */
export async function claimVisitorRuns(db: D1DataTableDatabase, visitor: string, userId: string): Promise<void> {
  await db.d1.prepare('update exercise_attempts set user_id = ? where visitor = ? and user_id is null').bind(userId, visitor).run()
}

/** Daily cron: signed-out runs older than `before` are dropped. */
export async function deleteOldAnonymousRuns(db: D1DataTableDatabase, before: number): Promise<void> {
  await db.d1.prepare('delete from exercise_attempts where user_id is null and created_at < ?').bind(before).run()
}
