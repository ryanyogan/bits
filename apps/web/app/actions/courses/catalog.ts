// Catalog filtering (Catalog.md §2c–2e). Filters are URL state
// (`?track=agents&q=rag`) so they can be shared and work without JS; this
// module turns the URL into the filtered list and the hrefs for each pill.
import { courses, type CourseSummary, type Track } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'

export type TrackSlug = 'foundations' | 'prompting' | 'tools' | 'agents'

export interface TrackFilter {
  /** `undefined` is "All". */
  slug?: TrackSlug
  label: 'All' | Track
  /** Dot colour; `undefined` for "All" (FilterPill draws it). */
  dot?: string
}

export const trackFilters: TrackFilter[] = [
  { label: 'All' },
  { slug: 'foundations', label: 'Foundations', dot: 'var(--track-foundations)' },
  { slug: 'prompting', label: 'Prompting', dot: 'var(--track-prompting)' },
  { slug: 'tools', label: 'Tools', dot: 'var(--track-tools)' },
  { slug: 'agents', label: 'Agents', dot: 'var(--track-agents)' },
]

export function trackSlug(track: Track): TrackSlug {
  return track.toLowerCase() as TrackSlug
}

export interface CatalogQuery {
  track?: TrackSlug
  q: string
  /** Signed-out preview (`?as=anon`), preserved across filter links. */
  anon: boolean
}

export function parseCatalogQuery(url: URL): CatalogQuery {
  let rawTrack = url.searchParams.get('track')?.toLowerCase()
  let track = trackFilters.find((filter) => filter.slug && filter.slug === rawTrack)?.slug
  let q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  return { track, q, anon: url.searchParams.get('as') === 'anon' }
}

function matchesQuery(course: CourseSummary, q: string): boolean {
  if (!q) return true
  let haystack = `${course.title} ${course.desc} ${course.track} ${course.sigil}`.toLowerCase()
  return haystack.includes(q.toLowerCase())
}

/** The query matches before the track filter, so pill counts reflect the search. */
export function filterCourses(query: Pick<CatalogQuery, 'track' | 'q'>, list: CourseSummary[] = courses) {
  let matching = list.filter((course) => matchesQuery(course, query.q))
  let counts = Object.fromEntries(
    trackFilters.map((filter) => [
      filter.slug ?? 'all',
      filter.slug ? matching.filter((course) => trackSlug(course.track) === filter.slug).length : matching.length,
    ]),
  ) as Record<TrackSlug | 'all', number>
  let results = query.track ? matching.filter((course) => trackSlug(course.track) === query.track) : matching
  return { results, counts }
}

/** `/courses` with the given filters; empty values are dropped so "All" is a clean URL. */
export function catalogHref(query: Partial<CatalogQuery>): string {
  let searchParams: Record<string, string> = {}
  if (query.track) searchParams.track = query.track
  if (query.q) searchParams.q = query.q
  if (query.anon) searchParams.as = 'anon'
  return routes.courses.index.href(undefined, { searchParams })
}

export function resultLabel(n: number): string {
  return `${n} ${n === 1 ? 'course' : 'courses'} · all free`
}
