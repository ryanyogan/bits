import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Viewer } from '../../../auth/identity.ts'
import { APP_TITLE } from '../../../config.ts'
import type { RewardNotice } from '../../../progress/reward.ts'
import { routes } from '../../../routes.ts'
import { ogImage } from '../../../ui/og.ts'
import { Layout } from '../../../ui/layout.tsx'
import type { CourseView } from './course-data.ts'
import { CourseLearn, CourseOutcomes, CourseProgress, CourseSource } from './ui/course-aside.tsx'
import { CourseHero } from './ui/course-hero.tsx'
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
 * grid (decision 047), laid out like an LMS course page (decision 066): a
 * compact hero, then the syllabus in the first screen with the side panels
 * beside it (progress, what you'll learn, how you'll learn, source), the
 * two joined into one plate. On a phone the panels stack: the syllabus
 * first, or the progress first once the course is started.
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
        <PageFrame mix={toneStyles[course.tone]}>
          <CourseHero view={view} coursesHref={coursesHref} trackHref={trackHref} />

          <RuledSection as="div" pad="none" rule={false}>
            <div mix={bodyStyle} data-started={view.state === 'new' ? undefined : ''}>
              <Slot area="syl">
                <Syllabus modules={view.modules} />
              </Slot>
              <Slot area="prog" side>
                <CourseProgress view={view} />
              </Slot>
              <Slot area="out" side>
                <CourseOutcomes outcomes={course.outcomes} />
              </Slot>
              <Slot area="how" side>
                <CourseLearn view={view} />
              </Slot>
              <Slot area="src" side>
                <CourseSource view={view} />
              </Slot>
            </div>
          </RuledSection>
        </PageFrame>
      </Layout>
    )
  }
}

/** One grid item of the body: `side` items are the column beside the syllabus. */
function Slot(handle: Handle<{ area: 'syl' | 'prog' | 'out' | 'how' | 'src'; side?: boolean; children?: RemixNode }>) {
  return () => (
    <div
      data-area={handle.props.area}
      data-side={handle.props.side ? '' : undefined}
      mix={slotStyle}
      style={{ gridArea: handle.props.area }}
    >
      {handle.props.children}
    </div>
  )
}

const WIDE = '@media (min-width: 1024px)'
const STACKED = '@media (max-width: 1023.98px)'
const line = 'var(--border-w) solid var(--line-cell)'

// Wide: the syllabus spans the rows of the side column, so it starts right
// under the hero. Stacked: the syllabus (or, once started, the progress)
// first, then the other panels.
const bodyStyle = css({
  display: 'grid',
  [WIDE]: {
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
    gridTemplateRows: 'auto auto auto 1fr',
    gridTemplateAreas: '"syl prog" "syl out" "syl how" "syl src"',
    '@media (min-width: 1440px)': { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 420px)' },
  },
  [STACKED]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateAreas: '"syl" "prog" "out" "how" "src"',
    // A hairline between stacked panels; the first one sits under the hero's rule.
    '& > :not([data-area="syl"])': { borderTop: line },
    '&[data-started]': {
      gridTemplateAreas: '"prog" "syl" "out" "how" "src"',
      '& > [data-area="prog"]': { borderTop: 0 },
      '& > [data-area="syl"]': { borderTop: line },
    },
  },
  '@media (forced-colors: active)': { '& > *': { borderColor: 'GrayText' } },
})
const slotStyle = css({
  minWidth: 0,
  [WIDE]: {
    '&[data-side]': { borderLeft: line },
    '&[data-side]:not([data-area="prog"])': { borderTop: line },
  },
})
