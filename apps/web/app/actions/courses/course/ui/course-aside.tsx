import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { HexBadge } from '@bits/ui/hex-badge'
import { KeyValueList } from '@bits/ui/key-value-list'
import { Panel } from '@bits/ui/panel'
import { ProgressRing } from '@bits/ui/progress-ring'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import { formatDate, type CourseView } from '../course-data.ts'

export interface CourseAsideProps {
  view: CourseView
  sourceHref: string
}

/**
 * Course.md §3b: progress + badge preview, how you'll learn, source. On the
 * grid (decision 047) it is one cell beside the syllabus, its three parts
 * stacked between hairlines, each under a mono strip heading. Static.
 */
export function CourseAside(handle: Handle<CourseAsideProps>) {
  return () => {
    let { view, sourceHref } = handle.props
    let { course } = view
    return (
      <aside aria-label="Course progress and details" mix={asideStyle}>
        <Panel id="progress-heading" title="Your progress">
          <div mix={partBody}>
            <div mix={progressRow}>
              <ProgressRing pct={view.pct} color="var(--tone)" />
              <div mix={progressText}>
                <span mix={progressTitle}>{`${view.done} of ${view.total} lessons`}</span>
                <span mix={mutedText}>{view.minsLeft === 0 ? 'all done' : `about ${view.minsLeft} min to go`}</span>
              </div>
            </div>
            <div mix={badgeRow}>
              <HexBadge name={course.badge.name} glyph={course.badge.glyph} color="var(--tone)" variant="preview" />
              <div mix={badgeText}>
                <span mix={badgeName}>{course.badge.name}</span>
                <span mix={badgeHint}>{`badge + ${view.neurons} neurons on finish`}</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel id="learn-heading" title="How you'll learn">
          <div mix={partBody}>
            <KeyValueList
              variant="course"
              items={view.learn.map((row) => ({ term: String(row.n), value: row.label, color: row.color }))}
            />
          </div>
        </Panel>

        <Panel id="source-heading" title="Source">
          <div mix={partBody}>
            <p mix={sourceText}>
              {`This course is ${view.source.files} markdown files. Spot a typo? Fix it in one pull request.`}
            </p>
            <a href={sourceHref} data-rmx-prefetch={prefetchFor(sourceHref)} mix={sourceLink}>
              {`${view.source.path} →`}
            </a>
            <p mix={bylineStyle}>
              {`Written by ${view.source.author} · updated `}
              <time datetime={view.source.updated}>{formatDate(view.source.updated)}</time>
            </p>
          </div>
        </Panel>
      </aside>
    )
  }
}

const asideStyle = css({ minWidth: 0, display: 'flex', flexDirection: 'column' })
const partBody = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const progressRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4_5)' })
const progressText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
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
const badgeText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-0_5)' })
const badgeName = css({ fontSize: 'var(--fs-14)', fontWeight: 600 })
const badgeHint = css({ fontSize: 'var(--fs-13)', color: 'var(--muted)' })

const sourceText = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--text-body)' })
const sourceLink = css({
  alignSelf: 'flex-start',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  position: 'relative',
  '&::before': { content: '""', position: 'absolute', inset: '-14px -6px' },
})
const bylineStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--dim)' })
