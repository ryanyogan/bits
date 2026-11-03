// /me's first band (decision 068): "My learning" answers "what do I do
// next?" before "who am I?". The current lesson of the most recent course in
// progress, or lesson 1 for an account with nothing done yet. A learner whose
// started courses are all finished gets no band: the course list is next.
import type { Handle } from 'remix/component'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { RuledSection } from '@bits/ui/ruled-section'

import type { NextStep } from '../home/continue.ts'

/**
 * The band: joined under the app bar, the banner rail to rail. The lesson is
 * `nextStep()` (home/continue.ts), the same one the landing and `/continue` use.
 */
export function NextLessonBand(handle: Handle<{ next: NextStep }>) {
  return () => {
    let { next } = handle.props
    let eyebrow =
      next.kind === 'start' ? `Start here · lesson 1 of ${next.total}` : `Continue · lesson ${next.n} of ${next.total}`
    return (
      <RuledSection aria-label={next.kind === 'start' ? 'Start here' : 'Continue where you left off'} rule={false} pad="none">
        <ContinueBanner
          href={next.href}
          courseTitle={next.courseTitle}
          eyebrow={eyebrow}
          nextLesson={next.lessonTitle}
          mins={next.mins}
          pct={next.pct}
          sigil={next.sigil}
          tone={next.tone}
          pattern={next.pattern}
          edge="flush"
        />
      </RuledSection>
    )
  }
}
