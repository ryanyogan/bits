// POST /api/ask (decision 052): grade an answer to an `:::ask` on the
// server, journal it (ask_attempts, within hourly caps), and award its xp
// once. Signed in, a right answer's xp goes on the account straight away,
// so a late answer on a finished lesson still counts. Signed out, it is
// held with the visitor's saved lesson and awarded at sign-in.
import { insertAskWithin, recordAskAward } from '@bits/db'
import type { AskVerdict } from '@bits/ui/lib/ask-client'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { asksOf } from '../actions/courses/lesson/content.ts'
import { sha256Hex } from '../auth/crypto.ts'
import { currentUser } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { MAX_ANSWER_LENGTH } from '../content/limits.ts'
import { getDatabase } from '../middleware/database.ts'
import { runOwner } from '../runs/run.ts'
import { gradeAsk } from './ask.ts'
import { markPassed, passedAsks } from './ask-session.ts'
import { blockShares } from './check.ts'
import { localDay } from './days.ts'
import { recordLateAnswer } from './progress.ts'

type AnyContext = RequestContext<any, any>

/** Answers journalled per hour before the server refuses more (429). */
export const askLimits = {
  /** Signed out, per session (visitor id). */
  anonymousPerHour: 60,
  /** Signed out, per IP. */
  anonymousPerIpHour: 240,
  userPerHour: 240,
}

const HOUR = 60 * 60 * 1000

export interface AnswerInput {
  course: string
  lesson: string
  ask: string
  answer: string
}

export type AnswerResult =
  | { ok: true; verdict: AskVerdict }
  | { ok: false; status: 404 | 400 | 429; error: 'not_found' | 'no_session' | 'limit' }

export async function findAsk(context: AnyContext, course: string, lesson: string, id: string) {
  let content = await (await getCatalog(context)).lessonContent(course, lesson)
  let block = content && asksOf(content).find((ask) => ask.id === id)
  return content && block ? { content, block } : undefined
}

/** Grades, journals and (when right) awards one answer. */
export async function answerAsk(context: AnyContext, input: AnswerInput): Promise<AnswerResult> {
  let found = await findAsk(context, input.course, input.lesson, input.ask)
  if (!found) return { ok: false, status: 404, error: 'not_found' }
  let { content, block } = found
  let answer = input.answer.trim().slice(0, MAX_ANSWER_LENGTH)
  let grade = gradeAsk(block, answer)

  let owner = runOwner(context, { create: true })
  if (!owner) return { ok: false, status: 400, error: 'no_session' }
  let db = getDatabase(context)
  let now = Date.now()
  let ipHash = owner.userId ? null : await sha256Hex(`ip:${context.headers.get('CF-Connecting-IP') ?? 'local'}`)
  let written = await insertAskWithin(
    db,
    {
      id: crypto.randomUUID(),
      owner,
      ipHash,
      courseId: input.course,
      lessonSlug: input.lesson,
      askId: block.id,
      answer,
      correct: grade.correct,
      now,
    },
    {
      hourSince: now - HOUR,
      hour: owner.userId ? askLimits.userPerHour : askLimits.anonymousPerHour,
      ipHour: askLimits.anonymousPerIpHour,
    },
  )
  if (!written) return { ok: false, status: 429, error: 'limit' }

  let xp = 0
  let user = currentUser(context)
  let session = context.get(Session)
  if (grade.correct) {
    let share = blockShares(content).shares.get(block.id) ?? 0
    if (user) {
      let fresh = await recordAskAward(db, {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: 'quiz',
        ref: `${input.course}/${input.lesson}/${block.id}`,
        xp: share,
        day: localDay(now, user.timezone),
        now,
      })
      if (fresh) xp = share
    } else if (!passedAsks(context, input.course, input.lesson).includes(block.id)) {
      xp = share
    }
    if (!user) recordLateAnswer(session, input.course, input.lesson, block)
    markPassed(session, input.course, input.lesson, block.id)
  }
  return {
    ok: true,
    verdict: {
      correct: grade.correct,
      answer,
      feedback: grade.feedback,
      checks: grade.checks,
      picks: grade.picks.map((pick) => ({ key: pick.key, correct: pick.correct })),
      xp,
      saved: Boolean(user),
    },
  }
}
