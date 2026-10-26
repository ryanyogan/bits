import type { Handle } from 'remix/component'
import { clientEntry, css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { whenPassed } from './lesson-state.ts'

export interface LessonCompleteProps {
  /** course/lesson; keys the remembered pass. */
  lessonKey: string
  /** The lesson has exercises whose checks must pass first. */
  gated: boolean
  /** Already passed on the server (a finished lesson). */
  passed: boolean
  /** Where finishing leads: the next lesson, or back to the course. */
  href: string
  label: string
  /** Signed out: after passing, nudge to sign in to keep the neurons. */
  loginHref?: string
}

/**
 * The "lesson complete" control at the end of a lesson. While the lesson's
 * checks are pending it is a disabled key with a hint; once they pass (the
 * `bits:reward` event, or a pass remembered for this lesson) it becomes the
 * link onward. Lessons without exercises are open from the start. Client
 * entry; without JS a gated lesson stays disabled, since the checks need JS.
 */
export const LessonComplete = clientEntry(
  import.meta.url,
  function LessonComplete(handle: Handle<LessonCompleteProps>) {
    let passed = handle.props.passed
    let earnedNow = false

    handle.queueTask(() => {
      if (passed || !handle.props.gated) return
      whenPassed(handle.props.lessonKey, handle.signal, () => {
        passed = true
        earnedNow = true
        handle.update()
      })
    })

    return () => {
      let { gated, href, label, loginHref } = handle.props
      let open = passed || !gated
      let hintId = `${handle.id}-hint`
      return (
        <div mix={wrapStyle}>
          {open ? (
            <>
              {gated ? (
                <span mix={doneStyle}>
                  <span aria-hidden="true">✓ </span>Lesson complete
                </span>
              ) : null}
              <Keycap href={href}>{label}</Keycap>
            </>
          ) : (
            <>
              <span id={hintId} mix={hintStyle}>
                Pass every check to finish
              </span>
              <Keycap disabled aria-describedby={hintId}>
                Complete lesson
              </Keycap>
            </>
          )}
          {passed && gated ? <span data-lesson-passed="" hidden /> : null}
          {earnedNow && loginHref ? (
            <a href={loginHref} mix={nudgeStyle}>
              Sign in to keep these neurons →
            </a>
          ) : null}
        </div>
      )
    }
  },
)

const wrapStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  marginLeft: 'auto',
})
const hintStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const doneStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--volt-soft)' })
const nudgeStyle = css({
  flexBasis: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minHeight: 'var(--touch-target)',
  fontSize: 'var(--fs-13)',
  color: 'var(--muted)',
  '&:hover': { color: 'var(--text)' },
})
