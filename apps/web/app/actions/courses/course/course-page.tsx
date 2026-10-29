import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid, type CellGridCols } from '@bits/ui/cell-grid'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../../auth/identity.ts'
import { APP_TITLE } from '../../../config.ts'
import type { RewardNotice } from '../../../progress/reward.ts'
import { routes } from '../../../routes.ts'
import { ogImage } from '../../../ui/og.ts'
import { Layout } from '../../../ui/layout.tsx'
import type { CourseView } from './course-data.ts'
import { CourseAside } from './ui/course-aside.tsx'
import { CourseHero } from './ui/course-hero.tsx'
import { stripHeading } from './ui/strip.ts'
import { Syllabus } from './ui/syllabus.tsx'
import { toneStyles } from './ui/tone.ts'

export interface CoursePageProps {
  view: CourseView
  viewer: Viewer | null
  /** A badge the last lesson completion earned (decision 028). */
  reward?: RewardNotice
  coursesHref: string
  trackHref: string
}

/**
 * `/courses/:course` (docs/design/spec/pages/Course.md), on the squared
 * grid (decision 047): one `PageFrame` in three bands. The hero (text |
 * art), the outcomes as a row of numbered cells, then the syllabus beside
 * the progress aside.
 */
export function CoursePage(handle: Handle<CoursePageProps>) {
  return () => {
    let { view, viewer, reward, coursesHref, trackHref } = handle.props
    let { course } = view
    return (
      <Layout
        title={course.title}
        description={course.desc}
        viewer={viewer}
        reward={reward}
        image={ogImage(`course-${course.slug}`, `${course.title}: a free ${APP_TITLE} course`)}
        currentPath={routes.courses.index.href()}
        canonicalPath={routes.courses.course.index.href({ course: course.slug })}
        bleed
      >
        <div mix={clipStyle}>
          <PageFrame mix={toneStyles[course.tone]}>
            <CourseHero view={view} coursesHref={coursesHref} trackHref={trackHref} />

            <RuledSection aria-labelledby="outcomes-heading" pad="none">
              <h2 id="outcomes-heading" mix={[stripHeading, openStrip]}>
                By the end you'll be able to
              </h2>
              <CellGrid as="ol" cols={outcomeCols(course.outcomes.length)}>
                {course.outcomes.map((outcome, index) => (
                  <li key={index} mix={outcomeCell}>
                    <span aria-hidden="true" mix={outcomeN}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {outcome}
                  </li>
                ))}
              </CellGrid>
            </RuledSection>

            <RuledSection as="div" pad="none">
              <div mix={bodyStyle}>
                <Syllabus modules={view.modules} />
                <CourseAside view={view} sourceHref={routes.author.course.index.href({ course: course.slug })} />
              </div>
            </RuledSection>
            <RuledSection as="div" pad="none">
              <div mix={tailStyle} />
            </RuledSection>
          </PageFrame>
        </div>
      </Layout>
    )
  }
}

// A RuledSection's rule is 100vw wide, which counts a classic scrollbar;
// body's clip propagates to the viewport, where it no longer stops a
// scroll, so the page clips its own sideways overflow (as the landing does).
const clipStyle = css({ overflowX: 'clip' })

/** Four outcomes in one row of four; otherwise rows of three. */
function outcomeCols(n: number): CellGridCols {
  return n % 4 === 0 ? 4 : n <= 2 ? 2 : 3
}

// The cells draw their own top hairlines, so the strip draws none.
const openStrip = css({ borderBottom: 0 })
const outcomeCell = css({
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  textWrap: 'pretty',
})
const outcomeN = css({
  display: 'block',
  marginBottom: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--tone)',
})

// The syllabus and the aside: two cells side by side from 1024px, with a
// hairline between them; stacked below that.
const bodyStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
  '& > :first-child': { borderRight: 'var(--border-w) solid var(--line-cell)' },
  '@media (max-width: 1023.98px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '& > :first-child': { borderRight: 0, borderBottom: 'var(--border-w) solid var(--line-cell)' },
  },
})
const tailStyle = css({ height: 'var(--space-16)' })
