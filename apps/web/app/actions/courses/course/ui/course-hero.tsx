import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CourseCover } from '@bits/ui/course-cover'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { RuledSection } from '@bits/ui/ruled-section'
import { Tag } from '@bits/ui/tag'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import { formatMins, type CourseView } from '../course-data.ts'
import { toneAlpha } from './tone.ts'

export interface CourseHeroProps {
  view: CourseView
  coursesHref: string
  trackHref: string
}

/**
 * Course.md §2 on the squared grid (decision 047), made compact by decision
 * 066 so the syllabus starts in the first screen: the text cell (breadcrumb,
 * title, lead, facts, the one CTA for the viewer's state and the lesson it
 * opens) and, from 1024px, the cover on the course's faint tone stripes.
 * Below 1024px the cover is dropped: it's decorative, and on a phone it
 * pushed the syllabus a screen down. Progress lives in the aside only.
 * Static.
 */
export function CourseHero(handle: Handle<CourseHeroProps>) {
  return () => {
    let { view, coursesHref, trackHref } = handle.props
    let { course } = view
    return (
      <RuledSection aria-labelledby="course-title" rule={false} pad="none">
        <div mix={gridStyle}>
          <div mix={textCol}>
            <nav aria-label="Breadcrumb" mix={crumbStyle}>
              <a href={coursesHref} data-rmx-prefetch={prefetchFor(coursesHref)} mix={crumbLink}>
                Courses
              </a>
              <span aria-hidden="true">/</span>
              <a href={trackHref} data-rmx-prefetch={prefetchFor(trackHref)} mix={[crumbLink, crumbTrack]}>
                {course.track}
              </a>
            </nav>
            <h1 id="course-title" mix={h1Style}>
              {course.title}
            </h1>
            <p mix={leadStyle}>{view.lead}</p>
            <ul aria-label="About this course" mix={metaList}>
              {view.soon ? (
                <li>
                  <Tag variant="soon" mix={soonTag}>
                    Coming soon
                  </Tag>
                </li>
              ) : null}
              {view.state === 'finished' ? (
                <li>
                  <Tag variant="done">✓ Finished</Tag>
                </li>
              ) : null}
              <li>
                <Tag variant="meta">{course.level}</Tag>
              </li>
              {view.total > 0 ? (
                <>
                  <li>
                    <Tag variant="meta">{`${view.total} lessons`}</Tag>
                  </li>
                  <li>
                    <Tag variant="meta">{formatMins(view.totalMins)}</Tag>
                  </li>
                </>
              ) : null}
              <li>
                <Tag variant="meta-ion" mix={toneTag}>
                  {course.formats.join(' + ')}
                </Tag>
              </li>
            </ul>
            {view.soon ? (
              // Coming soon (decision 073): no Start key, just what to expect.
              <p mix={ctaSub}>
                {view.total > 0
                  ? "Not open yet. The outline below is the plan; the lessons open when they're written and checked."
                  : "Not open yet. The lessons open here when they're written and checked."}
              </p>
            ) : null}
            {view.cta || view.secondary ? (
            <div mix={actionsStyle}>
              {view.cta ? (
                <div mix={ctaBlock}>
                  <Keycap size="lg" href={view.cta.href} mix={ctaStyle}>
                    {view.cta.label}
                  </Keycap>
                  {view.cta.sub ? <p mix={ctaSub}>{view.cta.sub}</p> : null}
                </div>
              ) : null}
              {view.secondary ? (
                <Keycap variant="ghost-mono" size="lg" href={view.secondary.href} mix={[ctaStyle, ghostStyle]}>
                  {view.secondary.icon ? <Icon name={view.secondary.icon} /> : null}
                  {view.secondary.label}
                </Keycap>
              ) : null}
            </div>
            ) : null}
          </div>
          <div aria-hidden="true" mix={artCol}>
            <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="art" mix={artStyle} />
          </div>
        </div>
      </RuledSection>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'
const STACKED = '@media (max-width: 1023.98px)'

// Text | art from 1024px (the art cell sized to the cover); text alone below.
const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  [STACKED]: { gridTemplateColumns: 'minmax(0, 1fr)' },
})
const textCol = css({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--space-5)',
  padding: 'var(--space-12) var(--cell-pad)',
  [MOBILE]: { gap: 'var(--space-4)', padding: 'var(--space-8) var(--cell-pad)' },
})
const crumbStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--muted)',
})
const crumbLink = css({
  color: 'var(--muted)',
  // Visual size stays 13px text; a ::before inset grows the hit area to 44px (resolutions §7).
  position: 'relative',
  '&::before': { content: '""', position: 'absolute', inset: '-14px -6px' },
  '&:hover': { color: 'var(--volt-link-hover)' },
})
const crumbTrack = css({ color: 'var(--tone)', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } })
const h1Style = css({
  margin: 0,
  maxWidth: '16ch',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(40px, 4.4vw, 60px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-display)',
  textWrap: 'balance',
  // A phone column inside the rails is ~280px: keep long words whole.
  [MOBILE]: { fontSize: 'var(--fs-32)', maxWidth: 'none' },
})
const leadStyle = css({
  margin: 0,
  maxWidth: '62ch',
  fontSize: 'var(--fs-18)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
  [MOBILE]: { fontSize: 'var(--fs-17)' },
})
const metaList = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
})
// The hero's tags are 13px; the soon tag matches their height.
const soonTag = css({ padding: 'var(--space-1_75) var(--space-2_75)', fontSize: 'var(--fs-13)' })
const toneTag = css({ borderColor: toneAlpha(35), color: 'var(--tone)' })
const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-3_5)',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  paddingTop: 'var(--space-1_5)',
})
const ctaBlock = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
  minWidth: 0,
  [MOBILE]: { flex: '1 1 100%' },
})
const ctaSub = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.45,
  color: 'var(--muted)',
})
const ctaStyle = css({ [MOBILE]: { flex: '1 1 100%' } })
const ghostStyle = css({ gap: 'var(--space-2_5)', padding: '0 var(--space-5)', fontSize: 'var(--fs-15)', maxWidth: '100%' })
const artCol = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  padding: 'var(--space-10) var(--space-12)',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  background: `repeating-linear-gradient(115deg, ${toneAlpha(0)} 0 22px, ${toneAlpha(6)} 22px 23px)`,
  [STACKED]: { display: 'none' },
})
const artStyle = css({
  width: '280px',
  '@media (min-width: 1280px)': { width: '320px' },
})
