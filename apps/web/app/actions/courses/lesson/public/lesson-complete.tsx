import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { whenPassed } from './lesson-state.ts'

export interface LessonCompleteProps {
  /** The lesson has exercises whose checks must pass first. */
  gated: boolean
  /** Already completed (saved on the server). */
  passed: boolean
  /** Where finishing leads: the next lesson, or back to the course. */
  href: string
  label: string
  /**
   * The native form that saves the lesson (absent in the author preview).
   * Exercises add their prompt and runs to it with `form=`; `fields` are
   * extra hidden fields (quiz answers).
   */
  form?: { id: string; action: string; fields: [name: string, value: string][] }
  /** Why the server refused the last save (422). */
  issues?: string[]
  /** Signed out: after passing, nudge to sign in to keep the neurons. */
  loginHref?: string
}

/**
 * The "lesson complete" control at the end of a lesson: a POST form that
 * saves the lesson and continues to `href`. While the lesson's checks are
 * pending the key is disabled with a hint; the `bits:reward` event (all
 * checks passed) enables it. The server re-runs every check on submit.
 * Lessons without exercises are open from the start. Client entry; without
 * JS a gated lesson stays disabled, since running prompts needs JS.
 *
 * Saving is optimistic (decision 043). As soon as the form submits, the
 * lesson reads as complete while the POST is in flight: the ✓ status, plus
 * the `[data-lesson-passed]` marker that turns the outline node and progress
 * segment volt. Success navigates to `href`, which replaces this island,
 * because the lesson `<main>` is keyed. If the server refuses (a 422
 * re-renders this lesson with `issues`), the frame's `reloadComplete` rolls
 * it back.
 */
export const LessonComplete = clientEntry(
  import.meta.url,
  function LessonComplete(handle: Handle<LessonCompleteProps>) {
    let passedNow = false
    /** The save is in flight: the lesson shows as complete until the frame settles. */
    let saving = false
    let settle = () => {
      if (!saving) return
      saving = false
      handle.update()
    }
    // Whatever the outcome, the frame's navigation settling ends the in-flight
    // state (guide 09; decision 024), as does a back/forward-cache restore.
    handle.queueTask(() => {
      handle.frame.addEventListener('reloadComplete', settle, { signal: handle.signal })
      window.addEventListener('pageshow', settle, { signal: handle.signal })
    })

    handle.queueTask(() => {
      if (handle.props.passed || !handle.props.gated) return
      whenPassed(handle.signal, () => {
        passedNow = true
        handle.update()
      })
    })

    return () => {
      let { gated, passed, href, label, form, issues, loginHref } = handle.props
      let open = passed || passedNow || !gated
      let hintId = `${handle.id}-hint`
      let issuesId = `${handle.id}-issues`
      let checksPassed = gated && (passed || passedNow)
      let showDone = checksPassed || saving
      return (
        <div mix={wrapStyle}>
          {issues?.length ? (
            <ul id={issuesId} role="alert" mix={issuesStyle}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          {showDone ? (
            <span mix={doneStyle}>
              <span aria-hidden="true">✓ </span>
              {passed || saving ? 'Lesson complete' : 'Checks passed'}
            </span>
          ) : null}
          {/* Mounted empty, so the text is announced when it arrives (decision 031). */}
          <span role="status" class="sr-only">
            {saving ? 'Saving your progress' : ''}
          </span>
          {!open ? (
            <span id={hintId} mix={hintStyle}>
              Pass every check to finish
            </span>
          ) : null}
          {passed || !form ? (
            open ? (
              <Keycap href={href}>{label}</Keycap>
            ) : (
              <Keycap disabled aria-describedby={hintId}>
                Complete lesson
              </Keycap>
            )
          ) : (
            <form
              id={form.id}
              method="post"
              action={form.action}
              mix={[
                formStyle,
                // A submit an earlier listener cancelled isn't a save. The
                // runtime still sends the POST (this handler doesn't prevent it).
                on('submit', (event) => {
                  if (event.defaultPrevented || saving) return
                  saving = true
                  handle.update()
                }),
              ]}
            >
              {form.fields.map(([name, value]) => (
                <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
              ))}
              <Keycap
                type="submit"
                disabled={!open}
                loading={saving}
                aria-describedby={!open ? hintId : issues?.length ? issuesId : undefined}
              >
                {open ? label : 'Complete lesson'}
              </Keycap>
            </form>
          )}
          {showDone ? <span data-lesson-passed="" hidden /> : null}
          {passedNow && loginHref ? (
            <a data-rmx-prefetch="intent" href={loginHref} mix={nudgeStyle}>
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
const formStyle = css({ display: 'contents' })
const issuesStyle = css({
  flexBasis: '100%',
  margin: 0,
  paddingLeft: 'var(--space-4)',
  fontSize: 'var(--fs-13)',
  color: 'var(--danger)',
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
