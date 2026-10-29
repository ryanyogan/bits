// What the session remembers about quick checks (decision 052): the asks
// this browser answered right, and a verdict flashed back to a native
// (no-JS) answer. Grader-free, so the lesson page reads it without the
// grading code in answers.ts.
import type { AskVerdict } from '@bits/ui/lib/ask-client'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

type AnyContext = RequestContext<any, any>

/** Session key: asks answered right, by `course/lesson` (the page's state across reloads). */
const ASKS_KEY = 'asks'
/** Session flash key: the last verdict, for the page a native (no-JS) answer lands on. */
const VERDICT_KEY = 'ask-verdict'
/** Lessons kept in the session's answered list; the oldest drop off. */
const MAX_LESSONS = 60

function readPassed(session: Session | undefined): Record<string, string[]> {
  let value = session?.get(ASKS_KEY)
  if (!value || typeof value !== 'object') return {}
  let passed: Record<string, string[]> = {}
  for (let [key, ids] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(ids)) passed[key] = ids.filter((id): id is string => typeof id === 'string')
  }
  return passed
}

/** Remembers that this browser answered `id` right. */
export function markPassed(session: Session | undefined, course: string, lesson: string, id: string): void {
  if (!session) return
  let passed = readPassed(session)
  let key = `${course}/${lesson}`
  let ids = passed[key] ?? []
  if (ids.includes(id)) return
  delete passed[key]
  // Newest last; keep the most recent lessons.
  let entries = [...Object.entries(passed), [key, [...ids, id]] as [string, string[]]].slice(-MAX_LESSONS)
  session.set(ASKS_KEY, Object.fromEntries(entries))
}

/**
 * The asks in course/lesson this browser has answered right (kept in the
 * session, so a reload or a no-JS answer keeps them answered). The journal
 * stays the truth for saving: this only draws the page.
 */
export function passedAsks(context: AnyContext, course: string, lesson: string): string[] {
  return readPassed(context.get(Session))[`${course}/${lesson}`] ?? []
}

export interface FlashedVerdict {
  course: string
  lesson: string
  ask: string
  verdict: AskVerdict
}

/** Shows `verdict` on the page a native answer redirects to. */
export function flashVerdict(context: AnyContext, flashed: FlashedVerdict): void {
  context.get(Session)?.flash(VERDICT_KEY, flashed)
}

/** The verdict a native answer flashed for this lesson, if any. */
export function takeVerdict(context: AnyContext, course: string, lesson: string): { ask: string; verdict: AskVerdict } | undefined {
  let value = context.get(Session)?.get(VERDICT_KEY) as Partial<FlashedVerdict> | undefined
  if (!value || typeof value !== 'object' || value.course !== course || value.lesson !== lesson) return undefined
  let { ask, verdict } = value
  if (typeof ask !== 'string' || !verdict || typeof verdict.correct !== 'boolean' || typeof verdict.feedback !== 'string') return undefined
  return { ask, verdict }
}
