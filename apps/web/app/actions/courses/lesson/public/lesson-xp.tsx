import type { Handle } from 'remix/component'
import { clientEntry } from 'remix/component'
import { XpPill } from '@bits/ui/xp-pill'

import { onAskReward, whenPassed } from './lesson-state.ts'

export interface LessonXpProps {
  /** The viewer's neurons when the page was rendered. */
  neurons: number
  /** Neurons this lesson awards when its checks pass (0 if already passed). */
  award: number
}

/**
 * The neurons pill in the LessonBar's `xp` slot on lesson pages (the AppBar
 * carries no XP pill; decision 048). Server-renders the current total; once
 * the lesson's checks pass it adds the award (1,240 → 1,280) and marks the
 * page as passed. Client entry.
 */
export const LessonXp = clientEntry(import.meta.url, function LessonXp(handle: Handle<LessonXpProps>) {
  let passed = false
  // Quick checks report the neurons the server gave them (0 when already counted).
  let asked = 0

  handle.queueTask(() => {
    onAskReward(handle.signal, (xp) => {
      asked += xp
      handle.update()
    })
    if (handle.props.award <= 0) return
    whenPassed(handle.signal, () => {
      passed = true
      handle.update()
    })
  })

  return () => {
    let { neurons, award } = handle.props
    return <XpPill neurons={(passed ? neurons + award : neurons) + asked} />
  }
})
