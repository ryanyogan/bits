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
  countRuns,
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
import { missHint, notGradedMessage, passNote, PATTERN_NOTES, strongerHint, type NotLive } from './coach-text.ts'
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
import { judgeModel, liveTemperatures, modelConfigured, ModelError, runsLive, type ModelEnv } from './model.ts'
import { dailyLiveCap, runLimits, runOwner } from './run.ts'

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

/** Why a live reply passed without the judge (a `soft` verdict): kept as the row's hint. */
const SOFT_NOTES = {
  cap: 'The coach’s hourly limit for this exercise is used up, so the reply checks decided this one, not the coach.',
  outage: 'The coach couldn’t be reached, so the reply checks decided this one, not the coach.',
  /** Rows written before the reason was recorded. */
  legacy: 'The coach didn’t judge this reply, so the reply checks decided it.',
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

/**
 * Why a journalled run's reply wasn't live, rebuilt from the journal. A
 * canned row doesn't record its reason, but the limits are counts of earlier
 * rows: a run whose owner, IP or the day was over a cap when it was written
 * was canned by that limit (run.ts). The counts are taken at the run's own
 * time, and later rows only add to them, so a mistake can only call an
 * outage a limit (no pass), never a limit an outage.
 */
async function whyNotLive(context: AnyContext, owner: RunOwner, ipHash: string | null, run: JournalRun): Promise<NotLive> {
  if (!modelConfigured(platform.env as ModelEnv)) return { kind: 'unconfigured' }
  let at = run.created_at
  let todaySince = at - (at % DAY)
  let counts = await countRuns(getDatabase(context), owner, ipHash, { hourSince: at - HOUR, daySince: at - DAY, todaySince })
  let signedIn = Boolean(owner.userId)
  let limit = (kind: 'hour' | 'day' | 'ip' | 'budget', cap: number, resetsAt: number): NotLive => ({
    kind: 'limit',
    limit: kind,
    cap,
    signedIn,
    resetsAt,
  })
  // The counts include this run, so "over" is more than the cap.
  if (signedIn) {
    if (counts.hour > runLimits.userPerHour) return limit('hour', runLimits.userPerHour, at + HOUR)
    if (counts.day > runLimits.userPerDay) return limit('day', runLimits.userPerDay, at + DAY)
  } else {
    if (counts.hour > runLimits.anonymousPerHour) return limit('hour', runLimits.anonymousPerHour, at + HOUR)
    if (ipHash && counts.ipHour > runLimits.anonymousPerIpHour) return limit('ip', runLimits.anonymousPerIpHour, at + HOUR)
  }
  if (!runsLive(run.temperature)) return { kind: 'example', live: liveTemperatures.map((t) => (t / 100).toFixed(1)) }
  if (counts.liveToday >= dailyLiveCap()) return limit('budget', dailyLiveCap(), todaySince + DAY)
  return { kind: 'outage' }
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
  let ipHash = owner.userId ? null : await sha256Hex(`ip:${context.headers.get('CF-Connecting-IP') ?? 'local'}`)
  let notLive = isLiveRun(run) ? undefined : await whyNotLive(context, owner, ipHash, run)
  // Over a limit, or at a temperature that never runs live: a saved example
  // that is neither graded nor journalled, so it can't pass and isn't a miss.
  if (notLive?.kind === 'limit' || notLive?.kind === 'example') {
    return { ok: true, verdict: await presentNotGraded(context, found, owner, run, notLive) }
  }
  let grade = gradeRun(block, { prompt: run.prompt, output: reply, live: isLiveRun(run) }, new Set(temperatures))
  let now = Date.now()
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
      hint: grade.holds ? passNote(grade.criteria) : missHint(block, grade.criteria, misses + 1),
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
  // A soft pass keeps why the judge didn't run as its hint (present() shows it as the note).
  let soft = (why: 'cap' | 'outage') => ({
    layer: 'soft' as const,
    passed: true,
    criteria: grade.criteria,
    hint: SOFT_NOTES[why],
  })
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
    let capped = soft('cap')
    let written = await insertVerdict(db, { ...base, ...capped })
    return written ? capped : 'raced'
  }

  let model: string | null = null
  let usage = { input: 0, output: 0 }
  let outcome: { layer: 'coach' | 'soft'; passed: boolean; criteria: VerdictCriterion[]; hint: string } = soft('outage')
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
      // On a pass the judge's text is dropped: it could question a line that
      // is met. On a miss it's kept only for a rubric line (missHint).
      let hint = applied.passed
        ? passNote(applied.criteria)
        : missHint(block, applied.criteria, misses + 1, safeJudgeHint(parsed.hint, block.reference))
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

  let verdict: CoachVerdict = {
    attempt: row.attempt_id ?? '',
    layer: row.layer === 'pending' || row.layer === 'reveal' ? 'reply' : row.layer,
    passed: row.passed,
    criteria: row.criteria,
    // A pass's line comes from its criteria (older rows kept the judge's text).
    hint: row.passed ? passNote(row.criteria) : row.hint,
    misses: history.misses,
    canReveal: !passedEver && Boolean(block.reference) && history.misses >= coachLimits.revealAfter,
    xp,
    saved: Boolean(user),
  }
  if (row.layer === 'pattern') {
    verdict.note = modelConfigured(platform.env as ModelEnv) ? PATTERN_NOTES.outage : PATTERN_NOTES.unconfigured
  }
  if (row.layer === 'soft') verdict.note = row.hint === SOFT_NOTES.cap || row.hint === SOFT_NOTES.outage ? row.hint : SOFT_NOTES.legacy
  if (!row.passed && history.misses >= coachLimits.strongerAfter) {
    // Never a hint this exercise already showed in a coach turn.
    let shown = new Set(verdicts.filter((v) => v.exercise_id === block.id && isGraded(v)).map((v) => v.hint))
    shown.add(row.hint)
    let stronger = strongerHint(block, row.criteria, history.misses, coachLimits.strongerAfter, shown)
    if (stronger) verdict.stronger = stronger
  }
  if (passedEver && block.reference) verdict.reference = block.reference
  if (row.passed) verdict.success = block.success.message
  if (halved) verdict.halved = true
  return verdict
}

/**
 * A saved example that wasn't graded (over a run limit, or a temperature
 * that never runs live): every criterion "not checked", no pass, no miss,
 * and the reason, with when it frees up, as the hint. Nothing is journalled.
 */
async function presentNotGraded(
  context: AnyContext,
  found: Found,
  owner: RunOwner,
  run: JournalRun,
  why: Extract<NotLive, { kind: 'limit' | 'example' }>,
): Promise<CoachVerdict> {
  let { block } = found
  let verdicts = await listLessonVerdicts(getDatabase(context), owner, { courseId: run.course_id, lessonSlug: run.lesson_slug })
  let history = exerciseHistory(verdicts, block.id)
  let passedEver = history.passedAt !== undefined
  let { criteria } = gradeRun(block, { prompt: run.prompt, output: run.output, live: false }, new Set())
  let verdict: CoachVerdict = {
    attempt: run.id,
    layer: why.kind,
    passed: false,
    criteria: criteria.map(({ note: _note, ...criterion }) => ({ ...criterion, met: null })),
    hint: notGradedMessage(why, Date.now()),
    misses: history.misses,
    canReveal: !passedEver && Boolean(block.reference) && history.misses >= coachLimits.revealAfter,
    xp: 0,
    saved: Boolean(currentUser(context)),
  }
  if (why.kind === 'limit') verdict.resetsAt = why.resetsAt
  if (passedEver && block.reference) verdict.reference = block.reference
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
