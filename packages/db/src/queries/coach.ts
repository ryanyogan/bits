// Coach verdicts (migration 0014, decision 064): POST /api/coach grades a
// journalled run and records the verdict here. The save reads passes from
// these rows and from the run journal, never from the form. A judge call is
// a live model call: it is reserved inside the insert, against the same
// daily live cap as the runs (never count first and insert later).
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { CoachLayer } from '../tables.ts'
import type { RunOwner } from './runs.ts'

function ownerColumn(owner: RunOwner): [column: 'user_id' | 'visitor', value: string] {
  return owner.userId ? ['user_id', owner.userId] : ['visitor', owner.visitor!]
}

/**
 * Live model calls by everyone since `?N`: live runs plus judge calls. One
 * expression, shared with insertRunWithin, so both caps count the same thing.
 */
export function liveTodaySql(param: string): string {
  return `((select count(*) from exercise_attempts where source = 'live' and created_at >= ${param})
    + (select count(*) from coach_verdicts where judged = 1 and created_at >= ${param}))`
}

/** A journalled run, as the coach and the save read it. */
export interface JournalRun {
  id: string
  course_id: string
  lesson_slug: string
  exercise_id: string
  prompt: string
  output: string
  source: 'live' | 'example' | 'fallback'
  temperature: number
  /** Null while a live run is still streaming. */
  model: string | null
  created_at: number
}

const RUN_COLUMNS = 'id, course_id, lesson_slug, exercise_id, prompt, output, source, temperature, model, created_at'

/** One of the owner's runs, or undefined (someone else's, a submission, or unknown). */
export async function findOwnRun(db: D1DataTableDatabase, owner: RunOwner, id: string): Promise<JournalRun | undefined> {
  let [column, bind] = ownerColumn(owner)
  let row = await db.d1
    .prepare(`select ${RUN_COLUMNS} from exercise_attempts where id = ? and ${column} = ? and source != 'submit'`)
    .bind(id, bind)
    .first<JournalRun>()
  return row ?? undefined
}

/** The owner's runs of one lesson's exercises, newest first (at most `limit`). */
export async function listLessonRuns(
  db: D1DataTableDatabase,
  owner: RunOwner,
  lesson: { courseId: string; lessonSlug: string },
  limit = 200,
): Promise<JournalRun[]> {
  let [column, bind] = ownerColumn(owner)
  let result = await db.d1
    .prepare(
      `select ${RUN_COLUMNS} from exercise_attempts
       where ${column} = ? and course_id = ? and lesson_slug = ? and source != 'submit'
       order by created_at desc, rowid desc limit ?`,
    )
    .bind(bind, lesson.courseId, lesson.lessonSlug, limit)
    .all<JournalRun>()
  return result.results
}

export interface VerdictCriterion {
  label: string
  kind: 'check' | 'run' | 'expect' | 'rubric'
  /** null: not checked (no live reply, or the coach couldn't judge it). */
  met: boolean | null
  /** Rubric lines only: a `must` decides the pass, a `should` is advice. */
  level?: 'must' | 'should'
  /** Why a deterministic check missed ("The reply has 4 sentences (2 at most)."). */
  note?: string
}

export interface CoachVerdict {
  id: string
  attempt_id: string | null
  course_id: string
  lesson_slug: string
  exercise_id: string
  layer: CoachLayer
  passed: boolean
  judged: boolean
  criteria: VerdictCriterion[]
  hint: string
  created_at: number
}

type VerdictRow = Omit<CoachVerdict, 'passed' | 'judged' | 'criteria'> & { passed: number; judged: number; criteria: string }

function decode(row: VerdictRow): CoachVerdict {
  let criteria: VerdictCriterion[] = []
  try {
    let parsed = JSON.parse(row.criteria) as unknown
    if (Array.isArray(parsed)) criteria = parsed as VerdictCriterion[]
  } catch {
    // A row written by a newer build: show no criteria rather than fail.
  }
  return { ...row, passed: row.passed === 1, judged: row.judged === 1, criteria }
}

const VERDICT_COLUMNS = 'id, attempt_id, course_id, lesson_slug, exercise_id, layer, passed, judged, criteria, hint, created_at'

export async function findVerdictForAttempt(db: D1DataTableDatabase, attemptId: string): Promise<CoachVerdict | undefined> {
  let row = await db.d1.prepare(`select ${VERDICT_COLUMNS} from coach_verdicts where attempt_id = ?`).bind(attemptId).first<VerdictRow>()
  return row ? decode(row) : undefined
}

/** The owner's verdicts (and reveals) for one lesson, oldest first. */
export async function listLessonVerdicts(
  db: D1DataTableDatabase,
  owner: RunOwner,
  lesson: { courseId: string; lessonSlug: string },
): Promise<CoachVerdict[]> {
  let [column, bind] = ownerColumn(owner)
  let result = await db.d1
    .prepare(
      `select ${VERDICT_COLUMNS} from coach_verdicts
       where ${column} = ? and course_id = ? and lesson_slug = ?
       order by created_at, rowid limit 500`,
    )
    .bind(bind, lesson.courseId, lesson.lessonSlug)
    .all<VerdictRow>()
  return result.results.map(decode)
}

export interface VerdictInput {
  id: string
  attemptId: string | null
  owner: RunOwner
  ipHash: string | null
  courseId: string
  lessonSlug: string
  exerciseId: string
  layer: CoachLayer
  passed: boolean
  criteria: VerdictCriterion[]
  hint: string
  now: number
}

/** The coach's caps for one judge call. */
export interface CoachCaps {
  hourSince: number
  /** Judge calls by this owner on this exercise since `hourSince`. */
  ownerHour: number
  /** Signed-out judge calls from `ipHash` since `hourSince` (ignored without one). */
  ipHour: number
  todaySince: number
  /** Live model calls by everyone today (runs + judge calls). */
  liveToday: number
}

const MAX_CRITERIA_JSON = 4000
const MAX_HINT = 400

function values(input: VerdictInput, judged: boolean): unknown[] {
  return [
    input.id,
    input.attemptId,
    input.owner.userId ?? null,
    input.owner.visitor ?? null,
    input.ipHash,
    input.courseId,
    input.lessonSlug,
    input.exerciseId,
    input.layer,
    input.passed ? 1 : 0,
    judged ? 1 : 0,
    JSON.stringify(input.criteria).slice(0, MAX_CRITERIA_JSON),
    input.hint.slice(0, MAX_HINT),
    input.now,
  ]
}

const INSERT_COLUMNS =
  'id, attempt_id, user_id, visitor, ip_hash, course_id, lesson_slug, exercise_id, layer, passed, judged, criteria, hint, created_at'

/**
 * Reserves a judge call: a `pending`, judged row, written only while the
 * owner's judge calls on this exercise in the last hour, the IP's (signed
 * out) and today's live calls stay under their caps, and while the run has
 * no verdict yet. One `INSERT … SELECT … WHERE` statement, so parallel
 * requests can't pass the same last slot. Returns whether it was written.
 */
export async function reserveJudgeCall(db: D1DataTableDatabase, input: VerdictInput, caps: CoachCaps): Promise<boolean> {
  let [column, bind] = ownerColumn(input.owner)
  let result = await db.d1
    .prepare(
      `insert into coach_verdicts (${INSERT_COLUMNS})
       select ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
       where not exists (select 1 from coach_verdicts where attempt_id = ?2)
         and (select count(*) from coach_verdicts
              where ${column} = ?15 and course_id = ?6 and lesson_slug = ?7 and exercise_id = ?8
                and judged = 1 and created_at >= ?16) < ?17
         and (?5 is null or (select count(*) from coach_verdicts
              where ip_hash = ?5 and user_id is null and judged = 1 and created_at >= ?16) < ?18)
         and ${liveTodaySql('?19')} < ?20`,
    )
    .bind(...values({ ...input, layer: 'pending', passed: false }, true), bind, caps.hourSince, caps.ownerHour, caps.ipHour, caps.todaySince, caps.liveToday)
    .run()
  return result.meta.changes === 1
}

/** Records a verdict that needed no judge call. False when the run already has one. */
export async function insertVerdict(db: D1DataTableDatabase, input: VerdictInput): Promise<boolean> {
  let result = await db.d1
    .prepare(`insert or ignore into coach_verdicts (${INSERT_COLUMNS}) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
    .bind(...values(input, false))
    .run()
  return result.meta.changes === 1
}

/** Fills in a reserved judge call once the judge answered (or couldn't). */
export async function finishJudgeCall(
  db: D1DataTableDatabase,
  id: string,
  verdict: {
    layer: Exclude<CoachLayer, 'pending' | 'reveal'>
    passed: boolean
    criteria: VerdictCriterion[]
    hint: string
    model: string | null
    inputTokens: number
    outputTokens: number
  },
): Promise<void> {
  await db.d1
    .prepare(
      `update coach_verdicts set layer = ?, passed = ?, criteria = ?, hint = ?, model = ?, input_tokens = ?, output_tokens = ?
       where id = ?`,
    )
    .bind(
      verdict.layer,
      verdict.passed ? 1 : 0,
      JSON.stringify(verdict.criteria).slice(0, MAX_CRITERIA_JSON),
      verdict.hint.slice(0, MAX_HINT),
      verdict.model,
      verdict.inputTokens,
      verdict.outputTokens,
      id,
    )
    .run()
}

/** Records that the learner asked to see the exercise's strong prompt. */
export async function insertReveal(
  db: D1DataTableDatabase,
  input: { id: string; owner: RunOwner; courseId: string; lessonSlug: string; exerciseId: string; now: number },
): Promise<void> {
  await insertVerdict(db, {
    ...input,
    attemptId: null,
    ipHash: null,
    layer: 'reveal',
    passed: false,
    criteria: [],
    hint: '',
  })
}

/** At sign-in: the visitor's signed-out verdicts join the account. */
export async function claimVisitorVerdicts(db: D1DataTableDatabase, visitor: string, userId: string): Promise<void> {
  await db.d1.prepare('update coach_verdicts set user_id = ? where visitor = ? and user_id is null').bind(userId, visitor).run()
}

/** The user's verdicts, newest first (the settings export). */
export async function listCoachVerdicts(db: D1DataTableDatabase, userId: string, limit = 500): Promise<CoachVerdict[]> {
  let result = await db.d1
    .prepare(`select ${VERDICT_COLUMNS} from coach_verdicts where user_id = ? order by created_at desc, rowid desc limit ?`)
    .bind(userId, limit)
    .all<VerdictRow>()
  return result.results.map(decode)
}
