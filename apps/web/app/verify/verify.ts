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
import { isPreview } from '../auth/config.ts'
import { currentUser } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { log } from '../log.ts'
import { getDatabase } from '../middleware/database.ts'
import { fetchLearnerWorker } from './fetch.ts'
import { gradeVerify } from './grade.ts'
import { markVerified, rememberOrigin } from './session.ts'
import { learnerOrigin, targetUrl } from './target.ts'

type AnyContext = RequestContext<any, any>

/** Checks journalled per hour before the server refuses more (429). */
export const verifyLimits = {
  /** Per user, every origin. */
  userPerHour: 30,
  /** Per user, per target origin. */
  originPerUserHour: 10,
  /** Everyone, per target origin: past this only users already checking it get in. */
  originSoftHour: 120,
  /** Everyone, per target origin, no exceptions: the most calls bits makes to one Worker in an hour. */
  originHardHour: 240,
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
  | { ok: false; status: 401 | 404 | 422 | 429; error: 'sign_in' | 'not_found' | 'invalid_url' | 'preview' | 'limit'; message: string }

export async function verifyDeploy(context: AnyContext, input: VerifyInput): Promise<VerifyOutcomeResult> {
  let content = await (await getCatalog(context)).lessonContent(input.course, input.lesson)
  let block = content && verifiesOf(content).find((b) => b.id === input.verify)
  if (!block) return { ok: false, status: 404, error: 'not_found', message: 'That deploy check isn’t in this lesson any more. Reload the page.' }

  // Previews never call out (decision 072, as they send no mail and run no
  // model): their journal is a separate database, so a check there would
  // sit outside production's per-origin caps.
  if (isPreview()) {
    return { ok: false, status: 422, error: 'preview', message: 'Deploy checks are off on preview deploys. Check yours on bits.yogan.dev.' }
  }

  let origin = learnerOrigin(input.url)
  if (!origin.ok) return { ok: false, status: 422, error: 'invalid_url', message: origin.message }
  let url = targetUrl(origin.origin, block.path)
  if (!url) return { ok: false, status: 422, error: 'invalid_url', message: 'bits can’t call that address. Paste your https://….workers.dev URL.' }

  // Signed-in only (decision 072): a visitor id costs nothing to mint, an
  // account costs a verified email under the daily mail cap.
  let user = currentUser(context)
  if (!user) return { ok: false, status: 401, error: 'sign_in', message: 'Sign in to check your deploy: the check is saved to your account.' }
  let db = getDatabase(context)
  let now = Date.now()
  let id = crypto.randomUUID()
  let logFields = { course: input.course, lesson: input.lesson, verify: block.id, host: url.hostname }
  let reserved = await reserveBuildCheck(
    db,
    { id, userId: user.id, courseId: input.course, lessonSlug: input.lesson, verifyId: block.id, origin: origin.origin, path: block.path, now },
    {
      hourSince: now - HOUR,
      hour: verifyLimits.userPerHour,
      originHour: verifyLimits.originPerUserHour,
      originSoftHour: verifyLimits.originSoftHour,
      originHardHour: verifyLimits.originHardHour,
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
