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

const INSERT_COLUMNS =
  'id, user_id, visitor, ip_hash, course_id, lesson_slug, exercise_id, prompt, source, temperature, output, model, created_at'

function runValues(input: RunInput): unknown[] {
  return [
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
  ]
}

/** Caps for insertRunWithin: the row is written only while every count is below its cap. */
export interface RunCaps {
  /** The owner's runs since `hourSince`. */
  hour: number
  /** The owner's runs since `daySince`. */
  day: number
  /** Signed-out runs from `ipHash` since `hourSince` (ignored without an ipHash). */
  ipHour: number
  /** Live runs by everyone since `todaySince`; null leaves it out. */
  liveToday: number | null
}

/**
 * Inserts the run only if it stays within `caps`, as one statement
 * (`INSERT … SELECT … WHERE count < cap`). D1 runs statements one at a time,
 * so parallel requests can't both pass the same last slot: the counts and
 * the insert can't interleave. Returns whether the row was written.
 */
export async function insertRunWithin(
  db: D1DataTableDatabase,
  input: RunInput,
  windows: { hourSince: number; daySince: number; todaySince: number },
  caps: RunCaps,
): Promise<boolean> {
  let [column, bind] = ownerColumn(input.owner)
  let result = await db.d1
    .prepare(
      `insert into exercise_attempts (${INSERT_COLUMNS})
       select ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
       where (select count(*) from exercise_attempts where ${column} = ?14 and ${RUNS} and created_at >= ?15) < ?16
         and (select count(*) from exercise_attempts where ${column} = ?14 and ${RUNS} and created_at >= ?17) < ?18
         and (?4 is null or (select count(*) from exercise_attempts where ip_hash = ?4 and user_id is null and created_at >= ?15) < ?19)
         and (?20 is null or (select count(*) from exercise_attempts where source = 'live' and created_at >= ?21) < ?20)`,
    )
    .bind(
      ...runValues(input),
      bind,
      windows.hourSince,
      caps.hour,
      windows.daySince,
      caps.day,
      caps.ipHour,
      caps.liveToday,
      windows.todaySince,
    )
    .run()
  return result.meta.changes === 1
}

/**
 * Saves a live run's streamed output, model and token counts once it ends.
 * Until then the reserved row has no model: a run in flight.
 */
export async function finishRun(
  db: D1DataTableDatabase,
  id: string,
  result: { output: string; model: string; inputTokens: number; outputTokens: number },
): Promise<void> {
  await db.d1
    .prepare('update exercise_attempts set output = ?, model = ?, input_tokens = ?, output_tokens = ? where id = ?')
    .bind(result.output.slice(0, MAX_JOURNAL_OUTPUT), result.model, result.inputTokens, result.outputTokens, id)
    .run()
}

/** A reserved live run whose model call failed becomes canned output. */
export async function markRunFallback(db: D1DataTableDatabase, id: string, output: string): Promise<void> {
  await db.d1
    .prepare(`update exercise_attempts set source = 'fallback', output = ?, model = null where id = ?`)
    .bind(output.slice(0, MAX_JOURNAL_OUTPUT), id)
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
