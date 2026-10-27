import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CourseCover } from '@bits/ui/course-cover'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { ProgressBar } from '@bits/ui/progress-bar'
import { Tag } from '@bits/ui/tag'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { CourseView } from '../course-data.ts'
import { toneAlpha } from './tone.ts'

export interface CourseHeroProps {
  view: CourseView
  coursesHref: string
  trackHref: string
}

/** Course.md §2: breadcrumb, title, lead, meta tags, CTAs and the cover art. Static. */
export function CourseHero(handle: Handle<CourseHeroProps>) {
  return () => {
    let { view, coursesHref, trackHref } = handle.props
    let { course } = view
    return (
      <section aria-labelledby="course-title" mix={bandStyle}>
        <div mix={innerStyle}>
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
              <li>
                <Tag variant="meta">{course.level}</Tag>
              </li>
              <li>
                <Tag variant="meta">{`${course.lessons} lessons`}</Tag>
              </li>
              <li>
                <Tag variant="meta">{`~${course.mins} min`}</Tag>
              </li>
              <li>
                <Tag variant="meta-ion" mix={toneTag}>
                  {course.formats.join(' + ')}
                </Tag>
              </li>
            </ul>
            <div mix={actionsStyle}>
              <Keycap size="lg" href={view.cta.href} mix={ctaStyle}>
                {view.cta.label}
              </Keycap>
              {view.intro ? (
                <Keycap variant="ghost-mono" size="lg" href={view.intro.href} mix={[ctaStyle, ghostStyle]}>
                  <Icon name="play-inline" />
                  {view.intro.label}
                </Keycap>
              ) : null}
            </div>
          </div>
          <div mix={artCol}>
            <CourseCover pattern={course.pattern} tone={course.tone} sigil={course.sigil} variant="art" mix={artStyle}>
              {view.pct > 0 ? (
                <span mix={chipStyle}>
                  <ProgressBar pct={view.pct} variant="art" color="var(--tone)" />
                  <span mix={chipText}>
                    {`${view.done}/${view.total} · ${view.pct}%`}
                    <span class="sr-only"> complete</span>
                  </span>
                </span>
              ) : null}
            </CourseCover>
          </div>
        </div>
      </section>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'

const bandStyle = css({
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  background: `repeating-linear-gradient(115deg, ${toneAlpha(0)} 0 22px, ${toneAlpha(6)} 22px 23px), var(--ink)`,
})
const innerStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-16)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-12)',
  alignItems: 'center',
  [MOBILE]: { padding: 'var(--space-8) var(--page-gutter) var(--space-10)', gap: 'var(--space-7)' },
})
const textCol = css({
  flex: '999 1 560px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5_5)',
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
  maxWidth: '12ch',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(40px, 5.6vw, 76px)',
  lineHeight: 0.98,
  letterSpacing: 'var(--tracking-display)',
  textWrap: 'balance',
})
const leadStyle = css({
  margin: 0,
  maxWidth: '600px',
  fontSize: 'var(--fs-19)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
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
const toneTag = css({ borderColor: toneAlpha(35), color: 'var(--tone)' })
const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-3_5)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1_5)',
})
const ctaStyle = css({ [MOBILE]: { flex: '1 1 100%' } })
const ghostStyle = css({ gap: 'var(--space-2_5)', padding: '0 var(--space-5)', fontSize: 'var(--fs-15)' })
const artCol = css({ flex: '1 1 320px', display: 'flex', justifyContent: 'center', minWidth: 0 })
const artStyle = css({ [MOBILE]: { width: '100%', maxWidth: '240px' } })
const chipStyle = css({
  position: 'absolute',
  left: 'var(--space-5)',
  right: 'var(--space-5)',
  bottom: 'var(--space-5)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--ink-a86)',
  border: 'var(--border-w) solid var(--line)',
  [MOBILE]: { left: 'var(--space-3)', right: 'var(--space-3)', bottom: 'var(--space-3)' },
})
const chipText = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--tone)', whiteSpace: 'nowrap' })
