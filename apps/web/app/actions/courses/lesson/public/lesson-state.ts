// Browser-side lesson progress shared by the lesson islands. Passing a
// lesson's checks fires `bits:reward` (from PromptComposer or TerminalLog);
// the islands remember it per course+lesson in localStorage until progress is
// saved on the server. Once passed, LessonComplete renders a hidden
// `[data-lesson-passed]` marker so static parts of the page (outline node,
// progress segment) can restyle with CSS alone (`:has()`), without touching
// server-rendered DOM.
import { REWARD_EVENT } from '@bits/ui/reward-toast'

/** Matches the document once the open lesson's checks have passed. */
export const PASSED_ROOT = ':root:has([data-lesson-passed])'

function storageKey(lessonKey: string) {
  return `bits:passed:${lessonKey}`
}

export function readPassed(lessonKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(lessonKey)) === '1'
  } catch {
    return false
  }
}

export function markPassed(lessonKey: string) {
  try {
    window.localStorage.setItem(storageKey(lessonKey), '1')
  } catch {
    // Storage unavailable (private mode): the pass lasts for this page only.
  }
}

/** Calls `listener` once the lesson's checks pass (now or on a later reward). */
export function whenPassed(lessonKey: string, signal: AbortSignal, listener: () => void) {
  if (readPassed(lessonKey)) {
    listener()
    return
  }
  window.addEventListener(
    REWARD_EVENT,
    () => {
      markPassed(lessonKey)
      listener()
    },
    { signal, once: true },
  )
}
