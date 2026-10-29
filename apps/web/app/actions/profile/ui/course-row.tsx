import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CourseCover } from '@bits/ui/course-cover'
import { ProgressBar } from '@bits/ui/progress-bar'
import { prefetchFor } from '@bits/ui/lib/prefetch'

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
 * CourseRow (components §9.9), as one row of a ruled panel list (decision
 * 047): the whole row is a link with a cover thumb and progress, and hover
 * steps the fill. A finished course is a `<div>` with its own "View
 * certificate" link.
 */
export function CourseRow(handle: Handle<CourseRowProps>) {
  return () => {
    let { course, own, handle: owner } = handle.props
    let href = routes.courses.course.index.href({ course: course.slug })

    if (course.pct >= 100) {
      let certificate = routes.certificates.show.href({ handle: owner, course: course.slug })
      return (
        <div mix={[rowStyle, finishedStyle]}>
          <span aria-hidden="true" mix={[thumbStyle, finishedThumb]}>
            <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke-width="2" stroke-linecap="square" style={{ stroke: 'var(--volt)' }} />
            </svg>
          </span>
          <span mix={[bodyStyle, finishedBody]}>
            <span mix={titleStyle}>{course.title}</span>
            <span mix={finishedMeta}>Finished · certificate ready</span>
          </span>
          <a
            href={certificate}
            data-rmx-prefetch={prefetchFor(certificate)}
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
      <a href={href} data-rmx-prefetch={prefetchFor(href)} mix={[rowStyle, linkRow]}>
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
  gap: 'var(--space-5)',
  padding: 'var(--space-4) var(--cell-pad)',
  flexWrap: 'wrap',
  color: 'var(--text)',
  textDecoration: 'none',
  [MOBILE]: { gap: 'var(--space-3_5)' },
})
const linkRow = css({
  transition: 'background-color var(--duration-fast) var(--ease)',
  '&:hover': { color: 'var(--text)', background: 'var(--cell-fill-hover)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@media (forced-colors: active)': { '&:hover': { textDecoration: 'underline' } },
})
// A finished course: a quiet volt wash and a volt edge on the left.
const finishedStyle = css({
  background: 'var(--volt-a05)',
  boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt)',
})
const thumbStyle = css({ [MOBILE]: { width: '48px', height: '48px' } })
const finishedThumb = css({
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: '64px',
  height: '64px',
  border: 'var(--border-w) solid var(--volt-a40)',
  background: 'var(--volt-a08)',
})
const bodyStyle = css({ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })
const finishedBody = css({ gap: 'var(--space-1)' })
const titleStyle = css({ fontSize: 'var(--fs-16)', fontWeight: 600 })
const barRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', fontVariantNumeric: 'tabular-nums' })
// On phones the whole row is the target and the label would wrap to a line
// of its own, so it goes.
const actionStyle = css({
  marginLeft: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  [MOBILE]: { display: 'none' },
})
const finishedMeta = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const certificateLink = css({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3_5)',
  border: 'var(--border-w) solid var(--volt-a40)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast)',
  '&:hover': { background: 'var(--volt-a08)' },
})
