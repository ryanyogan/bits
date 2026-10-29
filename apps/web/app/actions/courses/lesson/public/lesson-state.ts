// Browser-side lesson state shared by the lesson islands. Passing a lesson's
// checks fires `bits:reward` (from PromptComposer or TerminalLog); the islands
// listen for it to unlock "complete lesson" and add the neurons to the pill.
// Saving is the "complete lesson" form: the server re-runs the checks and
// stores progress (decision 016). Once passed, LessonComplete renders a
// hidden `[data-lesson-passed]` marker so static parts of the page (outline
// node, progress segment) can restyle with CSS alone (`:has()`), without
// touching server-rendered DOM.
import { GATE_EVENT } from '@bits/ui/lib/ask-client'
import { REWARD_EVENT, type RewardEventDetail } from '@bits/ui/reward-toast'

/** Matches the document once the open lesson's checks have passed. */
export const PASSED_ROOT = ':root:has([data-lesson-passed])'

/**
 * Calls `listener` once the lesson's prompt checks pass. A quick check's
 * reward (`source: 'ask'`) doesn't count: asks open their own gate.
 */
export function whenPassed(signal: AbortSignal, listener: () => void) {
  let controller = new AbortController()
  signal.addEventListener('abort', () => controller.abort())
  window.addEventListener(
    REWARD_EVENT,
    (event) => {
      if ((event as CustomEvent<RewardEventDetail>).detail?.source === 'ask') return
      controller.abort()
      listener()
    },
    { signal: controller.signal },
  )
}

/** Calls `listener` with each quick check's xp as it is answered right (decision 052). */
export function onAskReward(signal: AbortSignal, listener: (xp: number) => void) {
  window.addEventListener(
    REWARD_EVENT,
    (event) => {
      let detail = (event as CustomEvent<RewardEventDetail>).detail
      if (detail?.source === 'ask') listener(detail.xp)
    },
    { signal },
  )
}

/** Calls `listener` with an ask's id each time it is answered right. */
export function onAskAnswered(signal: AbortSignal, listener: (id: string) => void) {
  window.addEventListener(GATE_EVENT, (event) => listener((event as CustomEvent<{ id: string }>).detail.id), { signal })
}
