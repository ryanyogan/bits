import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { Viewer } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import type { CourseView } from './course-data.ts'
import { CourseAside } from './ui/course-aside.tsx'
import { CourseHero } from './ui/course-hero.tsx'
import { Syllabus } from './ui/syllabus.tsx'
import { toneStyles } from './ui/tone.ts'

export interface CoursePageProps {
  view: CourseView
  viewer: Viewer | null
  coursesHref: string
  trackHref: string
}

/** `/courses/:course` (docs/design/spec/pages/Course.md). */
export function CoursePage(handle: Handle<CoursePageProps>) {
  return () => {
    let { view, viewer, coursesHref, trackHref } = handle.props
    let { course } = view
    return (
      <Layout
        title={course.title}
        description={course.desc}
        viewer={viewer}
        currentPath={routes.courses.index.href()}
        bleed
      >
        <div mix={toneStyles[course.tone]}>
          <CourseHero view={view} coursesHref={coursesHref} trackHref={trackHref} />
          <div mix={bodyStyle}>
            <div mix={mainCol}>
              <section aria-labelledby="outcomes-heading" mix={outcomesSection}>
                <h2 id="outcomes-heading" mix={monoHeading}>
                  By the end you'll be able to
                </h2>
                <ol mix={outcomeGrid}>
                  {course.outcomes.map((outcome, index) => (
                    <li key={index} mix={outcomeCard}>
                      <span aria-hidden="true" mix={outcomeN}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {outcome}
                    </li>
                  ))}
                </ol>
              </section>
              <Syllabus modules={view.modules} />
            </div>
            <CourseAside view={view} sourceHref={routes.author.course.index.href({ course: course.slug })} />
          </div>
        </div>
      </Layout>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'

const bodyStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-10)',
  alignItems: 'flex-start',
  [MOBILE]: { padding: 'var(--space-8) var(--page-gutter) var(--space-16)', gap: 'var(--space-7)' },
})
const mainCol = css({
  flex: '999 1 560px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-10)',
})
const outcomesSection = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })
const monoHeading = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--fs-13)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  lineHeight: 'normal',
})
const outcomeGrid = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  gap: 'var(--space-3)',
})
const outcomeCard = css({
  padding: 'var(--space-4_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
  border: '1px solid var(--line-bar)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
})
const outcomeN = css({
  display: 'block',
  marginBottom: 'var(--space-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
})
