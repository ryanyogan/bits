import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CellGrid } from '@bits/ui/cell-grid'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { CourseCard, WriteCourseCard } from '@bits/ui/course-card'
import { EmptyState } from '@bits/ui/empty-state'
import { Eyebrow } from '@bits/ui/eyebrow'
import { FilterPill, scrollRowFade } from '@bits/ui/filter-pill'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'
import { SearchField } from '@bits/ui/search-field'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import type { Viewer } from '../../auth/identity.ts'
import type { CourseSummary } from '../../content/types.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { catalogHref, resultLabel, trackFilters, type CatalogQuery, type TrackSlug } from './catalog.ts'
import { CatalogBackground } from './public/catalog-bg.tsx'
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
  /** "About 7 hours in all", over the whole catalog (the count is the strip's). */
  summary: string
  /** A few real courses to offer when a search finds nothing. */
  suggestions: CourseSummary[]
  /** Authors and admins get the "write a course" cell; learners don't. */
  canWrite: boolean
  courseHref(slug: string): string
}

const SEARCH_ID = 'course-search'

// CellGrid's 3 columns from 1024px, as 4 from 1440px: every 3rd cell gets
// its right hairline back and every 4th ends the row (CellGrid's rule).
const fourUpStyle = css({
  '@media (min-width: 1440px)': {
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    '& > :nth-child(3n)': { borderRight: 'var(--border-w) solid var(--line-cell)' },
    '& > :nth-child(4n)': { borderRight: 0 },
  },
})

/**
 * `/courses` (docs/design/spec/pages/Catalog.md), on the squared grid
 * (decision 047): a `PageFrame` over the rabbit-hole background, in bands.
 * The title band is open so the hole shows; the continue banner, the
 * search + track toolbar and the course cells sit on flat ink.
 *
 * Search and the track pills are URL state. Typing (LiveSearch) or a pill
 * re-renders the whole page in place, so the counts, the result label and
 * the cells change together in one response. No `<Frame>`: the results
 * aren't a region with its own data (the counts share it), and a frame
 * request would add a round trip.
 */
export function CatalogPage(handle: Handle<CatalogPageProps>) {
  return () => {
    let { viewer, query, results, counts, continueTarget, summary, suggestions, canWrite, courseHref } = handle.props
    let hidden: Record<string, string> = {}
    if (query.track) hidden.track = query.track

    return (
      <Layout
        title="Courses"
        viewer={viewer}
        currentPath={routes.courses.index.href()}
        canonicalPath={routes.courses.index.href()}
        bleed
      >
        <div mix={stageStyle}>
          <CatalogBackground
            replayKey={`catalog-bg:${query.track ?? 'all'}`}
            courses={results.map((course) => ({ tone: course.tone, lessons: course.lessons }))}
          />
          <PageFrame>
            <RuledSection as="header" rule={false} pad="none" open>
              <div mix={titleBlock}>
                <Eyebrow>All courses · free</Eyebrow>
                <h1 mix={h1Style}>Pick your next rabbit hole.</h1>
                <p mix={leadStyle}>
                  {`${summary}: short, hands-on lessons that start with Claude, in your browser.`}
                </p>
              </div>
            </RuledSection>

            {continueTarget ? (
              <RuledSection aria-label="Continue where you left off" pad="none" open>
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
                  edge="flush"
                />
              </RuledSection>
            ) : null}

            <RuledSection
              as="div"
              open
              label="Find a course"
              aside={
                <p aria-live="polite" mix={resultStyle}>
                  {resultLabel(results.length)}
                </p>
              }
              pad="none"
              mix={toolbarBand}
            >
              <div mix={toolbarStyle}>
                <SearchField
                  action={routes.courses.index.href()}
                  value={query.q}
                  hidden={hidden}
                  id={SEARCH_ID}
                  variant="cell"
                  mix={searchCell}
                />
                <LiveSearch target={SEARCH_ID} />
                <nav aria-label="Filter by track" mix={[pillRow, scrollRowFade]}>
                  {trackFilters.map((filter) => (
                    <FilterPill
                      key={filter.label}
                      href={catalogHref({ track: filter.slug, q: query.q })}
                      dot={filter.dot}
                      count={counts[filter.slug ?? 'all']}
                      selected={filter.slug === query.track}
                      variant="cell"
                      keepPlace
                    >
                      {filter.label}
                    </FilterPill>
                  ))}
                </nav>
              </div>
            </RuledSection>

            {/* The grid continues the toolbar's block (decision 050): the toolbar heads it. */}
            <RuledSection aria-labelledby="courses-heading" pad="none" rule={false} open>
              <h2 id="courses-heading" class="sr-only">
                Courses
              </h2>
              {results.length === 0 ? (
                <div mix={emptyCell}>
                  <EmptyState
                    variant="bare"
                    title={query.q ? `No courses match “${query.q}”` : 'No courses here yet'}
                    hint="Try a shorter word, or start with one of these."
                    action={
                      <div mix={emptyActions}>
                        <ul aria-label="Suggested courses" mix={suggestList}>
                          {suggestions.map((course) => (
                            <li key={course.slug}>
                              <a href={courseHref(course.slug)} data-rmx-prefetch={prefetchFor(courseHref(course.slug))} mix={suggestLink}>
                                {`${course.title} →`}
                              </a>
                            </li>
                          ))}
                        </ul>
                        <Keycap variant="ghost" size="sm" href={catalogHref({})}>
                          Clear the search
                        </Keycap>
                      </div>
                    }
                  />
                </div>
              ) : null}
              {results.length > 0 ? (
                // From 1440px a grid of 4n cells takes 4 columns, so 8 courses
                // fill two rows instead of leaving an empty ninth plate.
                <CellGrid as="ul" cols={3} fill="ink" mix={(results.length + (canWrite ? 1 : 0)) % 4 === 0 ? fourUpStyle : undefined}>
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
                        pct={course.pct}
                        variant="cell"
                      />
                    </li>
                  ))}
                  {canWrite && results.length > 0 ? (
                    <li mix={cellStyle}>
                      <WriteCourseCard href={routes.author.index.href()} variant="cell" />
                    </li>
                  ) : null}
                </CellGrid>
              ) : null}
            </RuledSection>
          </PageFrame>
        </div>
      </Layout>
    )
  }
}

const PHONE = '@media (max-width: 480px)'
const STACKED = '@media (max-width: 1023.98px)'
const PHONE_GRID = '@media (max-width: 759.98px)'

/**
 * Holds the page and its background layer (z-index -1 stays inside it).
 * It clips sideways overflow: a RuledSection's rule is 100vw wide, which
 * counts a classic scrollbar, and body's own clip propagates to the
 * viewport, where it no longer stops a scroll.
 */
const stageStyle = css({ position: 'relative', isolation: 'isolate', overflowX: 'clip' })

const titleBlock = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  padding: 'var(--space-14) var(--section-pad-x) var(--space-12)',
  [PHONE]: { padding: 'var(--space-10) var(--section-pad-x) var(--space-8)' },
})
// The lead ends before the graph's side of the band; on paper it sits on the
// copy wash, since the scene shows through this open section (decision 063).
const leadStyle = css({
  margin: 0,
  width: 'fit-content',
  maxWidth: '44ch',
  background: 'var(--copy-wash)',
  fontSize: 'var(--fs-18)',
  lineHeight: 1.55,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
  [PHONE]: { fontSize: 'var(--fs-16)' },
})
const h1Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  maxWidth: '14ch',
  fontSize: 'clamp(36px, 5vw, 64px)',
  lineHeight: 1,
  textWrap: 'balance',
  letterSpacing: 'var(--tracking-tight)',
  // Inside the rails a phone column is ~300px: "rabbit hole." at 36px is the widest line.
  [PHONE]: { fontSize: 'var(--fs-32)' },
})

const toolbarBand = css({ background: 'var(--cell-fill)' })
const resultStyle = css({ margin: 0, color: 'var(--muted)' })

// Search and the track pills in one ruled row: search fills the left, the
// pills are cells on the right. Stacked under 1024px, search first.
const toolbarStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  minHeight: 'var(--control-lg)',
  [STACKED]: { gridTemplateColumns: 'minmax(0, 1fr)' },
})
const searchCell = css({
  borderRight: 'var(--border-w) solid var(--line-cell)',
  [STACKED]: { borderRight: 0, borderBottom: 'var(--border-w) solid var(--line-cell)' },
})
const pillRow = css({
  display: 'flex',
  minWidth: 0,
  // The last pill ends the row: the rail draws its right edge.
  '& > a:last-child': { borderRight: 0 },
  [STACKED]: {
    // Contains the pills' absolutely-positioned sr-only text, which would
    // otherwise escape the scroller and widen the page.
    position: 'relative',
    overflowX: 'auto',
    scrollSnapType: 'x proximity',
    scrollbarWidth: 'none',
    '& > a': { flex: '1 0 auto', scrollSnapAlign: 'start' },
  },
  // Phones: no sideways scroller, where the selected track could sit out of
  // view. "All" takes a row, the four tracks a 2 × 2 grid under it, every
  // pill in view. Hairlines are the gaps over a line-coloured ground.
  [PHONE_GRID]: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: 'var(--border-w)',
    overflowX: 'visible',
    background: 'var(--line-cell)',
    maskImage: 'none',
    animation: 'none',
    '& > a, & > a:last-child': { borderRight: 0, background: 'var(--cell-fill)', justifyContent: 'center' },
    '& > a:first-child': { gridColumn: '1 / -1' },
    '& > a': { minHeight: 'var(--touch-target)' },
  },
})

const emptyCell = css({ borderTop: 'var(--border-w) solid var(--line-cell)', background: 'var(--cell-fill)' })
const cellStyle = css({ display: 'flex' })
const emptyActions = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-5)' })
const suggestList = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-2_5)',
})
const suggestLink = css({ fontSize: 'var(--fs-16)', color: 'var(--text)', textUnderlineOffset: '0.2em' })
