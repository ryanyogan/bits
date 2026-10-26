import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Card } from '@bits/ui/card'
import { HexBadge } from '@bits/ui/hex-badge'
import { KeyValueList } from '@bits/ui/key-value-list'
import { ProgressRing } from '@bits/ui/progress-ring'

import { formatDate, type CourseView } from '../course-data.ts'

export interface CourseAsideProps {
  view: CourseView
  sourceHref: string
}

/** Course.md §3b: progress + badge preview, how you'll learn, source. Static. */
export function CourseAside(handle: Handle<CourseAsideProps>) {
  return () => {
    let { view, sourceHref } = handle.props
    let { course } = view
    return (
      <aside aria-label="Course progress and details" mix={asideStyle}>
        <Card variant="page">
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
        </Card>

        <Card variant="page" as="section" labelledBy="learn-heading" mix={learnCard}>
          <h2 id="learn-heading" mix={eyebrowHeading}>
            How you'll learn
          </h2>
          <KeyValueList
            variant="course"
            items={view.learn.map((row) => ({ term: String(row.n), value: row.label, color: row.color }))}
          />
        </Card>

        <Card variant="dashed" as="section" labelledBy="source-heading">
          <h2 id="source-heading" mix={eyebrowHeading}>
            Source
          </h2>
          <p mix={sourceText}>
            {`This course is ${view.source.files} markdown files. Spot a typo? Fix it in one pull request.`}
          </p>
          <a href={sourceHref} mix={sourceLink}>
            {`${view.source.path} →`}
          </a>
          <p mix={bylineStyle}>
            {`Written by ${view.source.author} · updated `}
            <time datetime={view.source.updated}>{formatDate(view.source.updated)}</time>
          </p>
        </Card>
      </aside>
    )
  }
}

const asideStyle = css({
  flex: '1 1 300px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
})
const progressRow = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-4_5)' })
const progressText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' })
const progressTitle = css({ fontSize: 'var(--fs-16)', fontWeight: 600 })
const mutedText = css({ fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const badgeRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--well)',
})
const badgeText = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-0_5)' })
const badgeName = css({ fontSize: 'var(--fs-14)', fontWeight: 600 })
const badgeHint = css({ fontSize: 'var(--fs-13)', color: 'var(--muted)' })

const learnCard = css({ gap: 'var(--space-3_5)' })
const eyebrowHeading = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontWeight: 400,
  fontSize: 'var(--fs-12)',
  letterSpacing: 'var(--tracking-eyebrow-s)',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  lineHeight: 'normal',
})
const sourceText = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--text-body)' })
const sourceLink = css({
  alignSelf: 'flex-start',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  position: 'relative',
  '&::before': { content: '""', position: 'absolute', inset: '-14px -6px' },
})
const bylineStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--dim)' })
