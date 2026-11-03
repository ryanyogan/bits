import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { HexBadge } from '@bits/ui/hex-badge'
import { KeyValueList } from '@bits/ui/key-value-list'
import { Panel } from '@bits/ui/panel'
import { ProgressRing } from '@bits/ui/progress-ring'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import { formatDate, formatDay, formatMins, type CourseView } from '../course-data.ts'

/**
 * The course page's side panels (Course.md §3b, decision 066). Each is its
 * own grid item so the page can place them: beside the syllabus from
 * 1024px, and on a phone the progress first, then the syllabus, then the
 * rest. Static.
 */

/**
 * The one progress indicator on the page. Before a start it says what
 * finishing earns instead of drawing an empty ring; signed out it says
 * progress stays in this browser until you sign in.
 */
export function CourseProgress(handle: Handle<{ view: CourseView }>) {
  return () => {
    let { view } = handle.props
    let { course } = view
    let started = view.state !== 'new'
    return (
      <Panel id="progress-heading" title={started ? 'Your progress' : 'On finishing'}>
        <div mix={partBody}>
          {started ? (
            <div mix={progressRow}>
              <ProgressRing pct={view.pct} color="var(--tone)" />
              <div mix={stackText}>
                <span mix={progressTitle}>{`${view.done} of ${view.total} lessons`}</span>
                <span mix={mutedText}>
                  {view.state === 'finished' ? 'Course finished' : `About ${formatMins(view.minsLeft)} left`}
                </span>
              </div>
            </div>
          ) : null}
          <div mix={badgeRow}>
            <HexBadge
              name={course.badge.name}
              glyph={course.badge.glyph}
              color="var(--tone)"
              variant={view.state === 'finished' ? 'earned' : 'preview'}
            />
            <div mix={stackText}>
              <span mix={badgeName}>{`${course.badge.name} badge`}</span>
              <span mix={badgeHint}>
                {view.soon
                  ? 'When the course opens: finish it for the badge and a certificate'
                  : view.state === 'finished'
                    ? `Earned, with ${view.neurons} neurons and a certificate`
                    : `Plus ${view.neurons} neurons and a certificate`}
              </span>
            </div>
          </div>
          <p mix={noteText}>Neurons are the points you earn for each lesson you finish.</p>
          {view.loginHref ? (
            <p mix={noteText}>
              {'Your progress stays in this browser. '}
              <a href={view.loginHref} data-rmx-prefetch={prefetchFor(view.loginHref)} mix={inlineLink}>
                Sign in
              </a>
              {' to keep it on every device.'}
            </p>
          ) : null}
        </div>
      </Panel>
    )
  }
}

/** The outcomes, as a checklist (they were a full band above the syllabus). */
export function CourseOutcomes(handle: Handle<{ outcomes: string[] }>) {
  return () => (
    <Panel id="outcomes-heading" title="What you'll learn">
      <ol mix={outcomeList}>
        {handle.props.outcomes.map((outcome, index) => (
          <li key={index} mix={outcomeItem}>
            <span aria-hidden="true" mix={outcomeN}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{outcome}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

export function CourseLearn(handle: Handle<{ view: CourseView }>) {
  return () => (
    <Panel id="learn-heading" title="How you'll learn">
      <KeyValueList
        variant="course"
        items={handle.props.view.learn.map((row) => ({ term: String(row.n), value: row.label, color: row.color }))}
      />
    </Panel>
  )
}

/** The course's markdown source on GitHub: the pull request the copy offers. */
export function CourseSource(handle: Handle<{ view: CourseView }>) {
  return () => {
    let { source } = handle.props.view
    return (
      <Panel id="source-heading" title="Source">
        <div mix={partBody}>
          <p mix={sourceText}>
            {`This course is ${source.files} markdown file${source.files === 1 ? '' : 's'} on GitHub. Spot a typo? Fix it in one pull request.`}
          </p>
          <a href={source.href} rel="noopener" data-rmx-document mix={sourceLink}>
            {`${source.path} ↗`}
          </a>
          <p mix={bylineStyle}>
            {`Written by ${source.author} · updated `}
            <time datetime={source.updated}>{formatDate(source.updated)}</time>
          </p>
          {source.verified ? (
            // The newest lesson `verified:` date (decision 073): when the code was last run.
            <p mix={bylineStyle}>
              {'Code verified '}
              <time datetime={source.verified}>{formatDay(source.verified)}</time>
            </p>
          ) : null}
        </div>
      </Panel>
    )
  }
}

const partBody = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const progressRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4_5)' })
const stackText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 })
const progressTitle = css({ fontSize: 'var(--fs-16)', fontWeight: 600 })
const mutedText = css({ fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const badgeRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3_5)',
  border: 'var(--border-w) solid var(--line-cell)',
  background: 'var(--well)',
})
const badgeName = css({ fontSize: 'var(--fs-14)', fontWeight: 600 })
const badgeHint = css({ fontSize: 'var(--fs-13)', lineHeight: 1.45, color: 'var(--muted)' })
const noteText = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--muted)' })
const inlineLink = css({ color: 'var(--volt)' })

const outcomeList = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
})
const outcomeItem = css({
  display: 'grid',
  gridTemplateColumns: 'var(--space-7) minmax(0, 1fr)',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  textWrap: 'pretty',
})
const outcomeN = css({
  paddingTop: '0.2em',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--tone)',
})

const sourceText = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--text-body)' })
const sourceLink = css({
  alignSelf: 'flex-start',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  overflowWrap: 'anywhere',
  position: 'relative',
  '&::before': { content: '""', position: 'absolute', inset: '-14px -6px' },
})
const bylineStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--dim)' })
