// POST /api/coach (decision 064): grade one journalled run of a prompt
// exercise, cheapest layer first, and journal the verdict.
//
// 1. Deterministic layers (grade.ts): prompt checks, the run requirement and,
//    on a live reply, the reply checks. If they decide, no model is called.
// 2. A coached block whose deterministic layers hold on a live reply goes to
//    the judge (judge.ts + judgeModel in model.ts), unless the injection
//    screen trips. The call is reserved inside the insert, against the
//    owner's and IP's hourly caps and the shared daily live cap.
// 3. Over a cap, or when the judge can't be reached, the rubric isn't judged
//    and the block passes on its deterministic layers: a "soft" pass,
//    labelled. A refusal or an unreadable verdict is different: the attempt
//    can provoke it, so it's a miss with "try again", never a pass.
//
// The prompt and reply always come from the journal (D1), never the request.
import {
  findOwnRun,
  findVerdictForAttempt,
  finishJudgeCall,
  insertReveal,
  insertVerdict,
  listLessonVerdicts,
  listRunTemperatures,
  recordAskAward,
  reserveJudgeCall,
  type CoachVerdict as VerdictRow,
  type JournalRun,
  type RunOwner,
  type VerdictCriterion,
  type VerdictInput,
} from '@bits/db'
import type { CoachVerdict } from '@bits/ui/lib/coach-client'
import type { RequestContext } from 'remix/router'

import { platform } from '#platform'

import { exercisesOf, type PromptBlock } from '../actions/courses/lesson/content.ts'
import { sha256Hex } from '../auth/crypto.ts'
import { currentUser } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { log } from '../log.ts'
import { getDatabase } from '../middleware/database.ts'
import { blockShares } from '../progress/check.ts'
import { localDay } from '../progress/days.ts'
import { exerciseHistory, exerciseXp, gradeRun, isGraded, isLiveRun, type DeterministicGrade } from './grade.ts'
import {
  applyJudge,
  judgeSystem,
  judgeUser,
  parseJudgeVerdict,
  safeJudgeHint,
  screenedCriteria,
  screensAsInjection,
  SCREENED_HINT,
  verdictSchema,
} from './judge.ts'
import { judgeModel, ModelError, type ModelEnv } from './model.ts'
import { dailyLiveCap, runOwner } from './run.ts'

type AnyContext = RequestContext<any, any>

/** Judge calls per exercise per hour; past them a live reply gets a soft pass (decision 064). */
export const coachLimits = {
  userPerExerciseHour: 12,
  anonymousPerExerciseHour: 6,
  anonymousPerIpHour: 20,
  /** Misses before "Stronger hint" and "Show a strong prompt". */
  strongerAfter: 3,
  revealAfter: 5,
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** The hint when the judge answered but its verdict can't be used. */
const UNGRADED_HINT = 'The coach couldn’t grade this attempt. Write the prompt in plain words and run it again.'

const NOTES = {
  pattern: 'Coach offline: this reply is a saved example. Checked by pattern, not by the coach.',
  soft: 'The coach didn’t judge this reply (its limit, or it couldn’t be reached), so it was checked on the reply checks only.',
}

export interface CoachRequest {
  course: string
  lesson: string
  exercise: string
}

export type CoachResult =
  | { ok: true; verdict: CoachVerdict }
  | { ok: false; status: 400 | 404 | 409; error: 'not_found' | 'no_session' | 'pending' }

interface Found {
  block: PromptBlock
  share: number
}

async function findCoachedExercise(context: AnyContext, input: CoachRequest): Promise<Found | undefined> {
  let content = await (await getCatalog(context)).lessonContent(input.course, input.lesson)
  let block = content && exercisesOf(content).find((exercise) => exercise.id === input.exercise)
  if (!content || !block) return undefined
  return { block, share: blockShares(content).shares.get(block.id) ?? 0 }
}

/** The authored hint for the n-th miss (1-based), general first. */
function authoredHint(block: PromptBlock, misses: number): string | undefined {
  let hints = block.hints ?? []
  return hints.length ? hints[Math.min(Math.max(misses, 1) - 1, hints.length - 1)] : undefined
}

/** The hint after a deterministic miss: the first failing check's note, else an authored hint. */
function deterministicHint(block: PromptBlock, criteria: VerdictCriterion[], misses: number): string {
  let missed = criteria.find((criterion) => criterion.met === false)
  if (missed?.note) return missed.note
  let authored = authoredHint(block, misses)
  if (authored) return authored
  return missed ? `Not yet: “${missed.label}”.` : 'Not yet. Try again.'
}

/** Grades a journalled run and journals the verdict (or reads back the one it already has). */
export async function coachAttempt(context: AnyContext, input: CoachRequest & { attempt: string }): Promise<CoachResult> {
  let found = await findCoachedExercise(context, input)
  if (!found) return { ok: false, status: 404, error: 'not_found' }
  let { block } = found
  let owner = runOwner(context)
  if (!owner) return { ok: false, status: 400, error: 'no_session' }
  let db = getDatabase(context)
  let exercise = { courseId: input.course, lessonSlug: input.lesson, exerciseId: block.id }

  let [run, existing, temperatures] = await Promise.all([
    findOwnRun(db, owner, input.attempt),
    findVerdictForAttempt(db, input.attempt),
    listRunTemperatures(db, owner, exercise),
  ])
  if (!run || run.course_id !== input.course || run.lesson_slug !== input.lesson || run.exercise_id !== block.id) {
    return { ok: false, status: 404, error: 'not_found' }
  }
  // Still streaming: the row is finished just before the stream closes.
  if (run.source === 'live' && run.model === null) return { ok: false, status: 409, error: 'pending' }
  if (existing?.layer === 'pending') return { ok: false, status: 409, error: 'pending' }
  if (existing) return { ok: true, verdict: await present(context, found, owner, existing, false) }

  let reply = run.output
  let grade = gradeRun(block, { prompt: run.prompt, output: reply, live: isLiveRun(run) }, new Set(temperatures))
  let now = Date.now()
  let ipHash = owner.userId ? null : await sha256Hex(`ip:${context.headers.get('CF-Connecting-IP') ?? 'local'}`)
  let base = {
    id: crypto.randomUUID(),
    attemptId: run.id,
    owner,
    ipHash,
    courseId: input.course,
    lessonSlug: input.lesson,
    exerciseId: block.id,
    now,
  }
  let misses = await missesSoFar(context, owner, input, block.id)

  let row: { layer: VerdictRow['layer']; passed: boolean; criteria: VerdictCriterion[]; hint: string }
  if (grade.layer !== 'judge') {
    row = {
      layer: grade.layer,
      passed: grade.holds,
      criteria: grade.criteria,
      hint: grade.holds ? block.success.message : deterministicHint(block, grade.criteria, misses + 1),
    }
  } else if (screensAsInjection(run.prompt) || screensAsInjection(reply)) {
    row = { layer: 'coach', passed: false, criteria: screenedCriteria(grade.criteria), hint: SCREENED_HINT }
  } else {
    let judged = await judge(context, block, grade, run, base, misses)
    if (judged === 'raced') {
      let again = await findVerdictForAttempt(db, run.id)
      if (!again || again.layer === 'pending') return { ok: false, status: 409, error: 'pending' }
      return { ok: true, verdict: await present(context, found, owner, again, false) }
    }
    let verdict: VerdictRow = {
      id: base.id,
      attempt_id: run.id,
      course_id: input.course,
      lesson_slug: input.lesson,
      exercise_id: block.id,
      judged: true,
      created_at: now,
      ...judged,
    }
    return { ok: true, verdict: await present(context, found, owner, verdict, true) }
  }

  let written = await insertVerdict(db, { ...base, ...row })
  if (!written) {
    let again = await findVerdictForAttempt(db, run.id)
    if (!again || again.layer === 'pending') return { ok: false, status: 409, error: 'pending' }
    return { ok: true, verdict: await present(context, found, owner, again, false) }
  }
  let verdict: VerdictRow = {
    id: base.id,
    attempt_id: run.id,
    course_id: input.course,
    lesson_slug: input.lesson,
    exercise_id: block.id,
    judged: false,
    created_at: now,
    ...row,
  }
  return { ok: true, verdict: await present(context, found, owner, verdict, true) }
}

/** Reserves, calls and records the judge. 'raced': another request already graded this run. */
async function judge(
  context: AnyContext,
  block: PromptBlock,
  grade: DeterministicGrade,
  run: JournalRun,
  base: Omit<VerdictInput, 'layer' | 'passed' | 'criteria' | 'hint'>,
  misses: number,
): Promise<'raced' | { layer: VerdictRow['layer']; passed: boolean; criteria: VerdictCriterion[]; hint: string }> {
  let db = getDatabase(context)
  let owner = base.owner
  let now = base.now
  let soft = {
    layer: 'soft' as const,
    passed: true,
    criteria: grade.criteria,
    hint: block.success.message,
  }
  let reserved = await reserveJudgeCall(
    db,
    { ...base, layer: 'pending', passed: false, criteria: [], hint: '' },
    {
      hourSince: now - HOUR,
      ownerHour: owner.userId ? coachLimits.userPerExerciseHour : coachLimits.anonymousPerExerciseHour,
      ipHour: coachLimits.anonymousPerIpHour,
      todaySince: now - (now % DAY),
      liveToday: dailyLiveCap(),
    },
  )
  if (!reserved) {
    if (await findVerdictForAttempt(db, run.id)) return 'raced'
    // Over a cap: the rubric isn't judged; the deterministic layers held.
    let written = await insertVerdict(db, { ...base, ...soft })
    return written ? soft : 'raced'
  }

  let model: string | null = null
  let usage = { input: 0, output: 0 }
  let outcome: { layer: 'coach' | 'soft'; passed: boolean; criteria: VerdictCriterion[]; hint: string } = soft
  try {
    let result = await judgeModel({
      system: judgeSystem(block),
      user: judgeUser(run.prompt, run.output),
      schema: verdictSchema,
      env: platform.env as ModelEnv,
    })
    model = result.model
    usage = result.usage
    let parsed = result.stopReason === 'refusal' ? undefined : parseJudgeVerdict(result.text, block.rubric?.length ?? 0)
    if (parsed) {
      let applied = applyJudge(block, grade.criteria, parsed, run.output, run.prompt)
      let hint = applied.passed
        ? safeJudgeHint(parsed.hint, block.reference) ?? block.success.message
        : safeJudgeHint(parsed.hint, block.reference) ?? authoredHint(block, misses + 1) ?? 'Not yet. Look at the ✗ lines.'
      outcome = { layer: 'coach', passed: applied.passed, criteria: applied.criteria, hint }
    } else {
      // A refusal or an unreadable verdict can be provoked by the attempt
      // itself (the eval's base64 injection gets a refusal), so it's never a
      // pass: the rubric stays unjudged and the learner tries again.
      log('warn', 'Coach verdict unusable', { stop: result.stopReason ?? 'none', exercise: block.id })
      outcome = { layer: 'coach', passed: false, criteria: grade.criteria, hint: UNGRADED_HINT }
    }
  } catch (error) {
    if (!(error instanceof ModelError)) throw error
    if (error.reason !== 'unconfigured') log('warn', 'Coach judge fell back', { reason: error.reason })
  }
  await finishJudgeCall(db, base.id, {
    ...outcome,
    model,
    inputTokens: usage.input,
    outputTokens: usage.output,
  })
  return outcome
}

async function missesSoFar(context: AnyContext, owner: RunOwner, input: CoachRequest, exerciseId: string): Promise<number> {
  let verdicts = await listLessonVerdicts(getDatabase(context), owner, { courseId: input.course, lessonSlug: input.lesson })
  return verdicts.filter((row) => row.exercise_id === exerciseId && isGraded(row) && !row.passed).length
}

/** The verdict as the island reads it, plus escalation and (on a new pass) the award. */
async function present(context: AnyContext, found: Found, owner: RunOwner, row: VerdictRow, fresh: boolean): Promise<CoachVerdict> {
  let { block, share } = found
  let db = getDatabase(context)
  let verdicts = await listLessonVerdicts(db, owner, { courseId: row.course_id, lessonSlug: row.lesson_slug })
  let history = exerciseHistory(verdicts, block.id)
  let passedEver = history.passedAt !== undefined
  let firstPass = fresh && row.passed && history.passedAt === row.created_at

  let xp = 0
  let user = currentUser(context)
  let halved = row.passed && history.revealedFirst
  if (firstPass) {
    let earned = exerciseXp(share, history.revealedFirst)
    if (user) {
      let now = Date.now()
      let awarded = await recordAskAward(db, {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: 'exercise',
        ref: `${row.course_id}/${row.lesson_slug}/${block.id}`,
        xp: earned,
        day: localDay(now, user.timezone),
        now,
      })
      if (awarded) xp = earned
    } else {
      xp = earned
    }
  }

  let hints = block.hints ?? []
  let verdict: CoachVerdict = {
    attempt: row.attempt_id ?? '',
    layer: row.layer === 'pending' || row.layer === 'reveal' ? 'reply' : row.layer,
    passed: row.passed,
    criteria: row.criteria,
    hint: row.hint,
    misses: history.misses,
    canReveal: !passedEver && Boolean(block.reference) && history.misses >= coachLimits.revealAfter,
    xp,
    saved: Boolean(user),
  }
  if (row.layer === 'pattern' || row.layer === 'soft') verdict.note = NOTES[row.layer]
  if (!row.passed && history.misses >= coachLimits.strongerAfter && hints.length) {
    verdict.stronger = hints[Math.min(history.misses - coachLimits.strongerAfter + 1, hints.length - 1)]
  }
  if (passedEver && block.reference) verdict.reference = block.reference
  if (row.passed) verdict.success = block.success.message
  if (halved) verdict.halved = true
  return verdict
}

export type RevealResult = { ok: true; reference: string } | { ok: false; status: 403 | 404 | 400; error: string }

/**
 * "Show a strong prompt": only after enough misses (or once passed), and
 * journalled, so a pass after it earns half.
 */
export async function revealReference(context: AnyContext, input: CoachRequest): Promise<RevealResult> {
  let found = await findCoachedExercise(context, input)
  if (!found?.block.reference) return { ok: false, status: 404, error: 'not_found' }
  let owner = runOwner(context)
  if (!owner) return { ok: false, status: 400, error: 'no_session' }
  let db = getDatabase(context)
  let history = exerciseHistory(
    await listLessonVerdicts(db, owner, { courseId: input.course, lessonSlug: input.lesson }),
    found.block.id,
  )
  if (history.passedAt !== undefined) return { ok: true, reference: found.block.reference }
  if (history.misses < coachLimits.revealAfter) return { ok: false, status: 403, error: 'not_yet' }
  if (history.revealedAt === undefined) {
    await insertReveal(db, {
      id: crypto.randomUUID(),
      owner,
      courseId: input.course,
      lessonSlug: input.lesson,
      exerciseId: found.block.id,
      now: Date.now(),
    })
  }
  return { ok: true, reference: found.block.reference }
}
