import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CourseCover } from '@bits/ui/course-cover'
import { ProgressBar } from '@bits/ui/progress-bar'

import type { CourseSummary } from '../../../content/types.ts'
import { routes } from '../../../routes.ts'

const toneColour = { volt: 'var(--volt)', ion: 'var(--ion)', synapse: 'var(--synapse)' } as const

export interface CourseRowProps {
  course: CourseSummary
  /** Own profile says "Resume →"; the public profile links to the course. */
  own: boolean
  /** The profile's handle, for the certificate link of a finished course. */
  handle: string
}

/**
 * CourseRow (components §9.9): a link row with a cover thumb and progress, or
 * the finished variant (a `<div>` with its own "View certificate" link).
 */
export function CourseRow(handle: Handle<CourseRowProps>) {
  return () => {
    let { course, own, handle: owner } = handle.props
    let href = routes.courses.course.index.href({ course: course.slug })

    if (course.pct >= 100) {
      return (
        <div mix={[rowStyle, finishedStyle]}>
          <span aria-hidden="true" mix={[thumbStyle, finishedThumb]}>
            <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke-width="2" stroke-linecap="round" style={{ stroke: 'var(--on-volt)' }} />
            </svg>
          </span>
          <span mix={[bodyStyle, finishedBody]}>
            <span mix={titleStyle}>{course.title}</span>
            <span mix={finishedMeta}>Finished · certificate ready</span>
          </span>
          <a
            href={routes.certificates.show.href({ handle: owner, course: course.slug })}
            mix={certificateLink}
            aria-label={`View certificate for ${course.title}`}
          >
            View certificate
          </a>
        </div>
      )
    }

    let colour = toneColour[course.tone]
    return (
      <a href={href} mix={[rowStyle, linkRow]}>
        <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="thumb" mix={thumbStyle} />
        <span mix={bodyStyle}>
          <span mix={titleStyle}>{course.title}</span>
          <span mix={barRow}>
            <ProgressBar pct={course.pct} variant="row" color={colour} />
            <span mix={pctStyle} style={{ color: colour }}>
              {course.pct}%<span class="sr-only"> complete</span>
            </span>
          </span>
        </span>
        <span mix={actionStyle}>{own ? 'Resume →' : 'View course →'}</span>
      </a>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4_5)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-16)',
  flexWrap: 'wrap',
  color: 'var(--text)',
  textDecoration: 'none',
  [MOBILE]: { gap: 'var(--space-3_5)' },
})
const linkRow = css({
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  transition: 'border-color var(--duration-fast)',
  '&:hover': { color: 'var(--text)', borderColor: 'var(--line-control)' },
})
const finishedStyle = css({ border: '1px solid var(--volt-a35)', background: 'var(--volt-a05)' })
const thumbStyle = css({ [MOBILE]: { width: '48px', height: '48px', borderRadius: 'var(--radius-12)' } })
const finishedThumb = css({
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: '64px',
  height: '64px',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--volt)',
})
const bodyStyle = css({ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })
const finishedBody = css({ gap: 'var(--space-1)' })
const titleStyle = css({ fontSize: 'var(--fs-16)', fontWeight: 600 })
const barRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)' })
const actionStyle = css({ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--volt)' })
const finishedMeta = css({ fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const certificateLink = css({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3_5)',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--volt-a40)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast)',
  '&:hover': { background: 'var(--volt-a08)' },
})
