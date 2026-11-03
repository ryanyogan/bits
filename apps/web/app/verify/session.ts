// What the session remembers about deploy checks (decision 072): the blocks
// this browser passed (to draw the page), the last origin checked (to fill
// the field next time), and a verdict flashed back to a native (no-JS)
// check. The journal (build_checks) stays the truth for saving. Free of the
// fetch and grading code, so the lesson page reads it cheaply.
import type { VerifyVerdict } from '@bits/ui/lib/verify-client'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

type AnyContext = RequestContext<any, any>

const PASSED_KEY = 'verifies'
const ORIGIN_KEY = 'verify-origin'
const FLASH_KEY = 'verify-verdict'
const MAX_LESSONS = 60

function readPassed(session: Session | undefined): Record<string, string[]> {
  let value = session?.get(PASSED_KEY)
  if (!value || typeof value !== 'object') return {}
  let passed: Record<string, string[]> = {}
  for (let [key, ids] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(ids)) passed[key] = ids.filter((id): id is string => typeof id === 'string')
  }
  return passed
}

/** Remembers that this browser passed verify block `id`. */
export function markVerified(session: Session | undefined, course: string, lesson: string, id: string): void {
  if (!session) return
  let passed = readPassed(session)
  let key = `${course}/${lesson}`
  let ids = passed[key] ?? []
  if (ids.includes(id)) return
  delete passed[key]
  let entries = [...Object.entries(passed), [key, [...ids, id]] as [string, string[]]].slice(-MAX_LESSONS)
  session.set(PASSED_KEY, Object.fromEntries(entries))
}

/** The verify blocks in course/lesson this browser has passed. */
export function passedVerifies(context: AnyContext, course: string, lesson: string): string[] {
  return readPassed(context.get(Session))[`${course}/${lesson}`] ?? []
}

/** Remembers the origin last checked, so the next block's field starts with it. */
export function rememberOrigin(session: Session | undefined, origin: string): void {
  session?.set(ORIGIN_KEY, origin)
}

/** The origin this browser checked last, if any. */
export function lastOrigin(context: AnyContext): string | undefined {
  let value = context.get(Session)?.get(ORIGIN_KEY)
  return typeof value === 'string' && value.length <= 300 ? value : undefined
}

export type FlashedCheck = { verify: string } & ({ verdict: VerifyVerdict } | { error: string; url: string })

/** Shows a verdict (or why the URL was refused) on the page a native check redirects to. */
export function flashCheck(context: AnyContext, course: string, lesson: string, flashed: FlashedCheck): void {
  context.get(Session)?.flash(FLASH_KEY, { course, lesson, ...flashed })
}

/** The check a native form flashed for this lesson, if any. */
export function takeCheck(context: AnyContext, course: string, lesson: string): FlashedCheck | undefined {
  let value = context.get(Session)?.get(FLASH_KEY) as (Partial<FlashedCheck> & { course?: string; lesson?: string; verdict?: VerifyVerdict; error?: string; url?: string }) | undefined
  if (!value || typeof value !== 'object' || value.course !== course || value.lesson !== lesson || typeof value.verify !== 'string') return undefined
  if (value.verdict && typeof value.verdict.passed === 'boolean') return { verify: value.verify, verdict: value.verdict }
  if (typeof value.error === 'string') return { verify: value.verify, error: value.error, url: typeof value.url === 'string' ? value.url.slice(0, 300) : '' }
  return undefined
}
