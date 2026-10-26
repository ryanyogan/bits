// Browser-side lesson state shared by the lesson islands. Passing a lesson's
// checks fires `bits:reward` (from PromptComposer or TerminalLog); the islands
// listen for it to unlock "complete lesson" and add the neurons to the pill.
// Saving is the "complete lesson" form: the server re-runs the checks and
// stores progress (decision 016). Once passed, LessonComplete renders a
// hidden `[data-lesson-passed]` marker so static parts of the page (outline
// node, progress segment) can restyle with CSS alone (`:has()`), without
// touching server-rendered DOM.
import { REWARD_EVENT } from '@bits/ui/reward-toast'

/** Matches the document once the open lesson's checks have passed. */
export const PASSED_ROOT = ':root:has([data-lesson-passed])'

/** Calls `listener` once the lesson's checks pass. */
export function whenPassed(signal: AbortSignal, listener: () => void) {
  window.addEventListener(REWARD_EVENT, () => listener(), { signal, once: true })
}
