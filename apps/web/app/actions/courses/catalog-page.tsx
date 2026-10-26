import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { CourseCard, WriteCourseCard, courseGridStyle } from '@bits/ui/course-card'
import { EmptyState } from '@bits/ui/empty-state'
import { Eyebrow } from '@bits/ui/eyebrow'
import { FilterPill } from '@bits/ui/filter-pill'
import { Keycap } from '@bits/ui/keycap'
import { SearchField } from '@bits/ui/search-field'

import type { CourseSummary, Viewer } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { catalogHref, resultLabel, trackFilters, type CatalogQuery, type TrackSlug } from './catalog.ts'
import { LiveSearch } from './public/live-search.tsx'

export interface ContinueTarget {
  href: string
  courseTitle: string
  lessonTitle: string
  n: number
  total: number
  mins: number
  pct: number
  sigil: string
  tone: CourseSummary['tone']
  pattern: CourseSummary['pattern']
}

export interface CatalogPageProps {
  viewer: Viewer | null
  query: CatalogQuery
  results: CourseSummary[]
  counts: Record<TrackSlug | 'all', number>
  continueTarget?: ContinueTarget
  /** Builds a course href, carrying `?as=anon` while previewing signed out. */
  courseHref(slug: string): string
}

const SEARCH_ID = 'course-search'

/** `/courses` (docs/design/spec/pages/Catalog.md). */
export function CatalogPage(handle: Handle<CatalogPageProps>) {
  return () => {
    let { viewer, query, results, counts, continueTarget, courseHref } = handle.props
    let hidden: Record<string, string> = {}
    if (query.track) hidden.track = query.track
    if (query.anon) hidden.as = 'anon'

    return (
      <Layout title="Courses" viewer={viewer} currentPath={routes.courses.index.href()} bleed>
        <div mix={pageStyle}>
          <div mix={titleRow}>
            <div mix={titleBlock}>
              <Eyebrow>All courses · free</Eyebrow>
              <h1 mix={h1Style}>
                Pick your next
                <br />
                rabbit hole.
              </h1>
            </div>
            <SearchField
              action={routes.courses.index.href()}
              value={query.q}
              hidden={hidden}
              id={SEARCH_ID}
              mix={searchStyle}
            />
            <LiveSearch target={SEARCH_ID} />
          </div>

          {continueTarget ? (
            <ContinueBanner
              href={continueTarget.href}
              courseTitle={continueTarget.courseTitle}
              eyebrow={`Continue · lesson ${continueTarget.n} of ${continueTarget.total}`}
              nextLesson={continueTarget.lessonTitle}
              mins={continueTarget.mins}
              pct={continueTarget.pct}
              sigil={continueTarget.sigil}
              tone={continueTarget.tone}
              pattern={continueTarget.pattern}
            />
          ) : null}

          <div mix={filterRow}>
            <nav aria-label="Filter by track" mix={pillRow}>
              {trackFilters.map((filter) => (
                <FilterPill
                  key={filter.label}
                  href={catalogHref({ track: filter.slug, q: query.q, anon: query.anon })}
                  dot={filter.dot}
                  count={counts[filter.slug ?? 'all']}
                  selected={filter.slug === query.track}
                >
                  {filter.label}
                </FilterPill>
              ))}
            </nav>
            <p aria-live="polite" mix={resultStyle}>
              {resultLabel(results.length)}
            </p>
          </div>

          <section aria-labelledby="courses-heading" mix={resultsStyle}>
            <h2 id="courses-heading" class="sr-only">
              Courses
            </h2>
            <ul mix={courseGridStyle}>
              {results.map((course) => (
                <li key={course.slug} mix={cellStyle}>
                  <CourseCard
                    href={courseHref(course.slug)}
                    title={course.title}
                    desc={course.desc}
                    track={course.track}
                    level={course.level}
                    lessons={course.lessons}
                    mins={course.mins}
                    sigil={course.sigil}
                    tone={course.tone}
                    pattern={course.pattern}
                    formats={course.formats}
                    pct={viewer ? course.pct : 0}
                    mix={cardFill}
                  />
                </li>
              ))}
              <li mix={cellStyle}>
                <WriteCourseCard href={routes.author.index.href()} />
              </li>
            </ul>
            {results.length === 0 ? (
              <EmptyState
                title={query.q ? `0 results for “${query.q}”` : '0 results'}
                hint="Try “agents”, “tokens” or clear the filter."
                action={
                  <Keycap variant="ghost" size="sm" href={catalogHref({ anon: query.anon })}>
                    Clear filters
                  </Keycap>
                }
              />
            ) : null}
          </section>
        </div>
      </Layout>
    )
  }
}

const MOBILE = '@media (max-width: 480px)'

const pageStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-12)',
  [MOBILE]: { padding: 'var(--space-8) var(--page-gutter) var(--space-16)', gap: 'var(--space-8)' },
})

const titleRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 'var(--space-8)',
  flexWrap: 'wrap',
})
const titleBlock = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3_5)' })
const h1Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(36px, 5vw, 64px)',
  lineHeight: 1,
  letterSpacing: 'var(--tracking-tight)',
})
const searchStyle = css({
  flex: '0 1 440px',
  maxWidth: 'none',
  [MOBILE]: { flex: '1 1 100%' },
})

const filterRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
})
const pillRow = css({
  display: 'flex',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  [MOBILE]: {
    flex: '1 1 100%',
    minWidth: 0,
    // Contains the pills' absolutely-positioned sr-only text, which would
    // otherwise escape the scroller and widen the page.
    position: 'relative',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    scrollSnapType: 'x proximity',
    scrollbarWidth: 'none',
    // Bleed to the screen edge; the vertical padding keeps focus rings unclipped.
    margin: 'calc(var(--space-1) * -1) calc(var(--page-gutter) * -1)',
    padding: 'var(--space-1) var(--page-gutter)',
    scrollPaddingInline: 'var(--page-gutter)',
    '& > a': { flex: 'none', scrollSnapAlign: 'start' },
  },
})
const resultStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--muted)',
})

const resultsStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)', [MOBILE]: { gap: 'var(--space-8)' } })
const cellStyle = css({ display: 'flex', minWidth: 0, '& > a': { flex: 1 } })
const cardFill = css({ width: '100%' })
