// POST /api/run (decision 019): limits, the journal and the canned fallback
// around `runModel`. Every run, live or canned, is one exercise_attempts row,
// and those rows are what "ran at 0 and 1.0" is checked against.
import {
  claimVisitorRuns,
  countRuns,
  finishRun,
  insertRunWithin,
  listRunTemperatures,
  markRunFallback,
  type D1DataTableDatabase,
  type RunCaps,
  type RunCounts,
  type RunOwner,
} from '@bits/db'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { platform } from '#platform'

import { exercisesOf, type PromptBlock } from '../actions/courses/lesson/content.ts'
import { offeredTemperatures } from '../actions/courses/lesson/ui/exercise.ts'
import { sha256Hex } from '../auth/crypto.ts'
import { currentUser } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { log } from '../log.ts'
import { getDatabase } from '../middleware/database.ts'
import { ModelError, runModel, runsLive, type ModelEnv, type ModelFailure } from './model.ts'

type AnyContext = RequestContext<any, any>

/** Starting values from the handoff; tune them from Gateway analytics. */
export const runLimits = {
  /** Signed out, per session (visitor id). The 11th run in an hour is canned. */
  anonymousPerHour: 10,
  /** Signed out, per IP: clearing cookies doesn't buy more live runs. */
  anonymousPerIpHour: 30,
  userPerHour: 60,
  userPerDay: 300,
  /** Past this multiple of the hourly limit a run is refused (429) and not journalled. */
  refuseAfter: 3,
  /** Live runs per UTC day for everyone, unless RUN_DAILY_LIVE_CAP says otherwise. */
  dailyLive: 1000,
}

/**
 * Runs from the landing's "Try it now" (decision 074). They are lesson 1's
 * runs (same exercise, journal and owner caps), with two tighter caps on
 * going live, so a crowd of first-time visitors can't spend the day's budget
 * before the lessons get any. Past either, the landing gets a refusal that
 * points at the lesson, never a canned reply graded as if live.
 */
export const tryLimits = {
  /** The owner's runs in the last hour (from anywhere) below which a landing run goes live. */
  perHour: 3,
  /** Landing runs go live only while the day's live calls are under this share of the daily cap. */
  dailyShare: 0.5,
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export type FallbackReason = 'limit' | 'budget' | ModelFailure

/** Session key for a signed-out visitor's random id (stays across sign-in). */
export const VISITOR_KEY = 'visitor'

/** Whose runs these are; creates the visitor id when asked. */
export function runOwner(context: AnyContext, options: { create?: boolean } = {}): RunOwner | null {
  let session = context.get(Session)
  let visitor = session?.get(VISITOR_KEY)
  let id = typeof visitor === 'string' ? visitor : null
  let user = currentUser(context)
  if (user) return { userId: user.id, visitor: id }
  if (!id && options.create && session) {
    id = crypto.randomUUID()
    session.set(VISITOR_KEY, id)
  }
  return id ? { visitor: id } : null
}

/** At sign-in: the visitor's runs move into the account (startUserSession). */
export async function claimRuns(db: D1DataTableDatabase, session: Session, userId: string): Promise<void> {
  let visitor = session.get(VISITOR_KEY)
  if (typeof visitor === 'string') await claimVisitorRuns(db, visitor, userId)
}

/** Temperatures (× 100) the viewer has run this exercise at, from the journal. */
export async function journalledTemperatures(
  context: AnyContext,
  exercise: { courseId: string; lessonSlug: string; exerciseId: string },
): Promise<number[]> {
  let owner = runOwner(context)
  return owner ? listRunTemperatures(getDatabase(context), owner, exercise) : []
}

export interface RunRequest {
  course: string
  lesson: string
  exercise: string
  prompt: string
  /** T × 100. */
  temperature: number
  /** Sent by the landing's composer (decision 074): its tighter live caps apply. */
  from?: 'landing'
}

/** The prompt exercise in the published lesson (decision 018), with its checks and examples. */
export async function findExercise(context: AnyContext, course: string, lesson: string, exercise: string): Promise<PromptBlock | undefined> {
  let content = await (await getCatalog(context)).lessonContent(course, lesson)
  return content && exercisesOf(content).find((block) => block.id === exercise)
}

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Runs a learner's prompt: a streamed live reply, or canned output, journalled
 * either way.
 *
 * Limits are enforced by the insert itself (insertRunWithin), not by a count
 * read earlier, so parallel requests can't overshoot them:
 * 1. A live temperature first reserves a `live` row within the owner's,
 *    the IP's and the daily live caps. Only a reserved run calls the model;
 *    if the model fails, the row becomes `fallback`.
 * 2. Otherwise the run is canned, and its row is written only below the
 *    refusal caps (`refuseAfter` × each limit). Past them it is a 429.
 */
export async function startRun(context: AnyContext, input: RunRequest): Promise<Response> {
  let block = await findExercise(context, input.course, input.lesson, input.exercise)
  if (!block) return jsonError('not_found', 404)
  if (!offeredTemperatures(block).includes(input.temperature)) return jsonError('temperature_not_offered', 422)

  let db = getDatabase(context)
  let owner = runOwner(context, { create: true })
  if (!owner) return jsonError('no_session', 400)
  let ip = context.headers.get('CF-Connecting-IP')
  let ipHash = owner.userId ? null : await sha256Hex(`ip:${ip ?? 'local'}`)
  let now = Date.now()
  let windows = { hourSince: now - HOUR, daySince: now - DAY, todaySince: now - (now % DAY) }
  let caps = ownerCaps(owner)
  let row = (id: string, source: 'live' | 'example' | 'fallback', output: string) => ({
    id,
    owner,
    ipHash,
    courseId: input.course,
    lessonSlug: input.lesson,
    exerciseId: input.exercise,
    prompt: input.prompt,
    source,
    temperature: input.temperature,
    output,
    model: null,
    now,
  })
  let example = () => pickExample(block, input.temperature)
  let live = runsLive(input.temperature)
  let landing = input.from === 'landing'

  if (live) {
    let id = crypto.randomUUID()
    let liveCaps = landing
      ? { ...caps, hour: Math.min(caps.hour, tryLimits.perHour), liveToday: tryLiveCap() }
      : { ...caps, liveToday: dailyLiveCap() }
    if (await insertRunWithin(db, row(id, 'live', ''), windows, liveCaps)) {
      return runLive(db, id, input, example)
    }
  }

  // Canned. Which limit (if any) applies only picks the label now; the
  // refusal caps below are enforced atomically like the live ones.
  let counts = await countRuns(db, owner, ipHash, windows)
  let over = overLimit(owner, counts)
  if (over === 'refuse') return refused()
  // Only the landing's own caps said no: a lesson run would still go live,
  // so the landing says so instead of journalling a canned reply (whose
  // reason the coach rebuilds from the lesson caps, decision 064).
  if (landing && live && !over && counts.liveToday < dailyLiveCap()) return tryLimited()
  let reason: FallbackReason | undefined = over ?? (live ? (counts.liveToday >= dailyLiveCap() ? 'budget' : 'limit') : undefined)
  let source: 'example' | 'fallback' = reason ? 'fallback' : 'example'
  let output = example()
  let refuseAt = runLimits.refuseAfter
  let cannedId = crypto.randomUUID()
  let written = await insertRunWithin(db, row(cannedId, source, output), windows, {
    hour: caps.hour * refuseAt,
    day: caps.day * refuseAt,
    ipHour: caps.ipHour * refuseAt,
    liveToday: null,
  })
  if (!written) return refused()
  return textResponse(output, source, reason, undefined, cannedId)
}

/** Calls the model for a reserved live row, then streams and journals the reply. */
async function runLive(db: D1DataTableDatabase, id: string, input: RunRequest, example: () => string): Promise<Response> {
  let abort = new AbortController()
  let run
  try {
    run = await runModel({ prompt: input.prompt, temperature: input.temperature, signal: abort.signal, env: platform.env as ModelEnv })
  } catch (error) {
    let reason: ModelFailure = error instanceof ModelError ? error.reason : 'unavailable'
    let output = example()
    await markRunFallback(db, id, output)
    if (!(error instanceof ModelError)) throw error
    if (reason !== 'unconfigured') {
      log('warn', 'Model run fell back', { reason })
    }
    return textResponse(output, 'fallback', reason, undefined, id)
  }
  let model = run.model
  let finish = async (output: string) => {
    let usage = await run.usage
    await finishRun(db, id, { output, model, inputTokens: usage.input, outputTokens: usage.output })
  }
  return textResponse(journalled(run.stream, finish, () => abort.abort()), 'live', undefined, model, id)
}

function refused(): Response {
  return jsonError('rate_limited', 429, { retryAfter: 3600 })
}

/** A landing run past the landing's caps (decision 074): not journalled; the lesson has more runs. */
function tryLimited(): Response {
  let response = jsonError('try_limit', 429, { retryAfter: 3600 })
  response.headers.set('X-Run-Reason', 'try-limit')
  return response
}

/** Live calls per UTC day below which a landing run may go live: a share of the daily cap. */
export function tryLiveCap(): number {
  return Math.floor(dailyLiveCap() * tryLimits.dailyShare)
}

/** The owner's hourly and daily caps; signed-out visitors also have a per-IP cap and no daily one. */
function ownerCaps(owner: RunOwner): Omit<RunCaps, 'liveToday'> {
  return owner.userId
    ? { hour: runLimits.userPerHour, day: runLimits.userPerDay, ipHour: 0 }
    : { hour: runLimits.anonymousPerHour, day: Number.MAX_SAFE_INTEGER, ipHour: runLimits.anonymousPerIpHour }
}

function overLimit(owner: RunOwner, counts: RunCounts): 'limit' | 'refuse' | null {
  let { refuseAfter } = runLimits
  let checks: [count: number, limit: number][] = owner.userId
    ? [
        [counts.hour, runLimits.userPerHour],
        [counts.day, runLimits.userPerDay],
      ]
    : [
        [counts.hour, runLimits.anonymousPerHour],
        [counts.ipHour, runLimits.anonymousPerIpHour],
      ]
  if (checks.some(([count, limit]) => count >= limit * refuseAfter)) return 'refuse'
  if (checks.some(([count, limit]) => count >= limit)) return 'limit'
  return null
}

/** Live model calls (runs and coach judge calls) per UTC day for everyone. */
export function dailyLiveCap(): number {
  let raw = platform.env.RUN_DAILY_LIVE_CAP
  let value = raw ? Number(raw) : NaN
  return Number.isInteger(value) && value >= 0 ? value : runLimits.dailyLive
}

/** One of the lesson's canned outputs for this temperature. */
function pickExample(block: PromptBlock, temperature: number): string {
  let all = block.examples
  let matching = all.filter((example) => Math.round(example.temperature * 100) === temperature)
  let pool = matching.length ? matching : all
  if (pool.length === 0) return 'No example output for this exercise yet.'
  return pool[Math.floor(Math.random() * pool.length)]!.text
}

/**
 * Plain text, streamed. The headers say what it is: X-Run-Source is live,
 * example or fallback; X-Run-Reason says why a fallback happened.
 */
function textResponse(
  body: string | ReadableStream<Uint8Array>,
  source: 'live' | 'example' | 'fallback',
  reason?: FallbackReason,
  model?: string,
  /** The journal row: the composer sends it to /api/coach once the stream ends (decision 064). */
  runId?: string,
): Response {
  let headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Run-Source': source,
  })
  if (reason) headers.set('X-Run-Reason', reason)
  if (model) headers.set('X-Run-Model', model)
  if (runId) headers.set('X-Run-Id', runId)
  return new Response(body, { headers })
}

/**
 * Encodes the model's text for the response and keeps a copy for the
 * journal. The row is finished before the stream closes; if the browser
 * goes away first (a rerun aborts the fetch), the provider request is
 * aborted and the row is finished in the background.
 */
function journalled(
  source: ReadableStream<string>,
  finish: (output: string) => Promise<void>,
  abort: () => void,
): ReadableStream<Uint8Array> {
  let reader = source.getReader()
  let encoder = new TextEncoder()
  let output = ''
  let finished = false
  let end = () => {
    if (finished) return Promise.resolve()
    finished = true
    return finish(output)
  }
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let next = await reader.read()
        if (next.done) {
          await end()
          controller.close()
          return
        }
        output += next.value
        controller.enqueue(encoder.encode(next.value))
      } catch (error) {
        await end().catch(() => undefined)
        controller.error(error)
      }
    },
    cancel(reason) {
      abort()
      platform.waitUntil(Promise.all([reader.cancel(reason), end()]))
    },
  })
}
