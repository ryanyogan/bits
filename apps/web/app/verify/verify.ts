// POST /api/verify (decision 072): check a learner's deployed Worker for a
// `:::verify` block. The learner's origin is checked first (workers.dev
// only), a journal row is reserved within the hourly caps, then bits calls
// the block's path once and grades the reply on the server. The verdict is
// journalled; "Complete lesson" reads passes from the journal only.
import { finishBuildCheck, reserveBuildCheck } from '@bits/db'
import type { VerifyVerdict } from '@bits/ui/lib/verify-client'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { verifiesOf } from '../actions/courses/lesson/content.ts'
import { sha256Hex } from '../auth/crypto.ts'
import { getCatalog } from '../content/request.ts'
import { log } from '../log.ts'
import { getDatabase } from '../middleware/database.ts'
import { runOwner } from '../runs/run.ts'
import { fetchLearnerWorker } from './fetch.ts'
import { gradeVerify } from './grade.ts'
import { markVerified, rememberOrigin } from './session.ts'
import { learnerOrigin, targetUrl } from './target.ts'

type AnyContext = RequestContext<any, any>

/** Checks journalled per hour before the server refuses more (429). */
export const verifyLimits = {
  /** Signed in, per user. */
  userPerHour: 30,
  /** Signed out, per session (visitor id). */
  anonymousPerHour: 10,
  /** Signed out, per IP: clearing cookies doesn't buy more checks. */
  anonymousPerIpHour: 30,
  /** Everyone together, per target origin: bits is never a request cannon aimed at one Worker. */
  originPerHour: 60,
}

const HOUR = 60 * 60 * 1000

export interface VerifyInput {
  course: string
  lesson: string
  verify: string
  /** What the learner pasted. */
  url: string
}

export type VerifyOutcomeResult =
  | { ok: true; verdict: VerifyVerdict }
  | { ok: false; status: 404 | 400 | 422 | 429; error: 'not_found' | 'no_session' | 'invalid_url' | 'limit'; message: string }

export async function verifyDeploy(context: AnyContext, input: VerifyInput): Promise<VerifyOutcomeResult> {
  let content = await (await getCatalog(context)).lessonContent(input.course, input.lesson)
  let block = content && verifiesOf(content).find((b) => b.id === input.verify)
  if (!block) return { ok: false, status: 404, error: 'not_found', message: 'That deploy check isn’t in this lesson any more. Reload the page.' }

  let origin = learnerOrigin(input.url)
  if (!origin.ok) return { ok: false, status: 422, error: 'invalid_url', message: origin.message }
  let url = targetUrl(origin.origin, block.path)
  if (!url) return { ok: false, status: 422, error: 'invalid_url', message: 'bits can’t call that address. Paste your https://….workers.dev URL.' }

  let owner = runOwner(context, { create: true })
  if (!owner) return { ok: false, status: 400, error: 'no_session', message: 'Couldn’t start a session. Reload the page and try again.' }
  let db = getDatabase(context)
  let now = Date.now()
  let id = crypto.randomUUID()
  let ipHash = owner.userId ? null : await sha256Hex(`ip:${context.headers.get('CF-Connecting-IP') ?? 'local'}`)
  let logFields = { course: input.course, lesson: input.lesson, verify: block.id, host: url.hostname, signedIn: Boolean(owner.userId) }
  let reserved = await reserveBuildCheck(
    db,
    { id, owner, ipHash, courseId: input.course, lessonSlug: input.lesson, verifyId: block.id, origin: origin.origin, path: block.path, now },
    {
      hourSince: now - HOUR,
      hour: owner.userId ? verifyLimits.userPerHour : verifyLimits.anonymousPerHour,
      ipHour: verifyLimits.anonymousPerIpHour,
      originHour: verifyLimits.originPerHour,
    },
  )
  if (!reserved) {
    log('warn', 'Build check refused: hourly cap', logFields)
    return { ok: false, status: 429, error: 'limit', message: 'That’s a lot of checks this hour. Give it a little while, then try again.' }
  }

  let fetched = await fetchLearnerWorker(url)
  let verdict = gradeVerify(block, origin.origin, fetched)
  await finishBuildCheck(db, id, {
    outcome: verdict.outcome,
    status: verdict.status ?? null,
    durationMs: verdict.ms,
  })
  // The authored path only, never what the learner pasted (it may carry a query).
  log('info', 'Build check', { ...logFields, path: block.path, outcome: verdict.outcome, status: verdict.status ?? null, ms: verdict.ms })

  let session = context.get(Session)
  rememberOrigin(session, origin.origin)
  if (verdict.passed) markVerified(session, input.course, input.lesson, block.id)
  return { ok: true, verdict }
}
