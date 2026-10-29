import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { focusOutline, FORCED_COLORS } from './lib/states.ts'

export type ActivityLevel = 0 | 1 | 2 | 3

export interface ActivityGridProps {
  /** 182 levels (26 weeks × 7 days), oldest first, column-major (weeks). */
  levels: ActivityLevel[]
  /** Summary for screen readers, e.g. "Activity heatmap: active 41 of the last 182 days". */
  label: string
  heading?: string
  /** Heading level; Profile uses 2 (the heading sits under the page h1). */
  headingLevel?: 2 | 3
  /** Optional per-cell hover titles, e.g. "Oct 12 · 3 activities" (same order as `levels`). */
  titles?: string[]
  /** The last day drawn (YYYY-MM-DD). With it, month names run along the top. */
  end?: string
  /** A short line under the grid, left of the legend: "Active 6 of 182 days". */
  caption?: RemixNode
  /**
   * `card` (default): its own hairline box with a mono heading. `bare`: just
   * the grid, caption and legend, for a page that draws the box and the
   * heading itself (the profile's ruled panels).
   */
  variant?: 'card' | 'bare'
  mix?: MixInput<HTMLElement>
}

/**
 * 26-week heatmap (components §11.3), squared (decision 047): flat square
 * cells on a hairline grid, sized to fill the width (7–24px), so a phone
 * shows all 26 weeks without scrolling. One `role="img"` with a summary
 * label; if the room ever runs out, the grid scrolls inside, starting at
 * the latest week. Static.
 */
export function ActivityGrid(handle: Handle<ActivityGridProps>) {
  return () => {
    let {
      levels,
      label,
      heading = 'ACTIVITY · LAST 26 WEEKS',
      headingLevel = 3,
      titles,
      end,
      caption,
      variant = 'card',
      mix,
    } = handle.props
    let weeks = Math.ceil(levels.length / 7)
    let months = end ? monthLabels(levels.length, end) : []
    let columns = { gridTemplateColumns: `repeat(${weeks}, minmax(var(--heat-min), var(--heat-max)))` }
    let chart = (
      <div mix={scrollStyle} tabIndex={0} aria-label="Activity heatmap, scrollable">
        <div mix={chartStyle}>
          {months.length ? (
            <div aria-hidden="true" mix={monthsStyle} style={columns}>
              {months.map((month) => (
                <span key={month.col} style={{ gridColumn: `${month.col + 1}` }}>
                  {month.label}
                </span>
              ))}
            </div>
          ) : null}
          <div role="img" aria-label={label} mix={gridStyle} style={columns}>
            {levels.map((level, index) => (
              <span key={index} data-level={level} title={titles?.[index]} mix={cellStyle} />
            ))}
          </div>
        </div>
      </div>
    )
    let foot = (
      <div mix={footStyle}>
        {caption ? <p mix={captionStyle}>{caption}</p> : <span />}
        <div aria-hidden="true" mix={legendStyle}>
          less
          {([0, 1, 2, 3] as const).map((level) => (
            <span key={level} data-level={level} mix={[cellStyle, swatchStyle]} />
          ))}
          more
        </div>
      </div>
    )
    if (variant === 'bare') {
      return (
        <div mix={[bareStyle, mix]}>
          {chart}
          {foot}
        </div>
      )
    }
    return (
      <section aria-label="Activity" mix={[cardStyle, mix]}>
        {headingLevel === 2 ? <h2 mix={headingStyle}>{heading}</h2> : <h3 mix={headingStyle}>{heading}</h3>}
        {chart}
        {foot}
      </section>
    )
  }
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

/**
 * Month names for the week columns: a column is labelled when its first day
 * starts a new month. The first column's label is dropped when the next one
 * follows within two weeks, so the names never overlap.
 */
export function monthLabels(days: number, end: string): Array<{ col: number; label: string }> {
  let last = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(last)) return []
  let labels: Array<{ col: number; label: string; month: number }> = []
  for (let col = 0; col * 7 < days; col++) {
    let day = new Date(last - (days - 1 - col * 7) * 86_400_000)
    let month = day.getUTCMonth()
    if (labels.at(-1)?.month !== month) labels.push({ col, label: monthFormat.format(day), month })
  }
  if (labels.length > 1 && labels[1]!.col - labels[0]!.col < 3) labels.shift()
  return labels.map(({ col, label }) => ({ col, label }))
}

/** Deterministic sample data (seeded PRNG, seed 42), as on the Profile artboard. */
export function sampleActivity(seed = 42): ActivityLevel[] {
  let state = seed
  let random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  return Array.from({ length: 182 }, (_, i) => {
    if (i > 168) return (random() > 0.4 ? 3 : 2) as ActivityLevel
    let p = 0.15 + (i / 182) * 0.55
    if (random() > p) return 0
    let r = random()
    return (r < 0.5 ? 1 : r < 0.85 ? 2 : 3) as ActivityLevel
  })
}

// Cell size bounds: 7px fits 26 weeks in a 280px phone column; 24px keeps
// the grid a heatmap, not a wall, on a wide one.
const sizes = { '--heat-min': '7px', '--heat-max': '24px', '--heat-gap': 'var(--space-0_75)' }

const cardStyle = css({
  ...sizes,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-5)',
  border: 'var(--border-w) solid var(--line-cell)',
  minWidth: 0,
})
const bareStyle = css({ ...sizes, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
// MonoHeading recipe (components §11.3 / §8.2): Geist Mono 500 13px, .14em.
const headingStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  fontWeight: 500,
  lineHeight: 'normal',
  letterSpacing: 'var(--tracking-eyebrow)',
  color: 'var(--muted)',
})
// row-reverse starts the scroll position at the right end (the latest week)
// if the grid ever overflows, with no JS; `safe` keeps it left-aligned when
// it fits.
const scrollStyle = css({
  display: 'flex',
  flexDirection: 'row-reverse',
  justifyContent: 'safe flex-end',
  overflowX: 'auto',
  '&:focus-visible': focusOutline,
})
const chartStyle = css({ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)', minWidth: 'min-content' })
const monthsStyle = css({
  display: 'grid',
  columnGap: 'var(--heat-gap)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-10)',
  lineHeight: 1,
  color: 'var(--dim)',
  '& > span': { gridRow: 1, whiteSpace: 'nowrap' },
})
const gridStyle = css({
  display: 'grid',
  gridTemplateRows: 'repeat(7, auto)',
  gridAutoFlow: 'column',
  gap: 'var(--heat-gap)',
})
const cellStyle = css({
  aspectRatio: '1',
  background: 'var(--fill-seg)',
  '&[data-level="1"]': { background: 'var(--volt-a25)' },
  '&[data-level="2"]': { background: 'var(--volt-a55)' },
  '&[data-level="3"]': { background: 'var(--volt)' },
  '&:hover': { outline: 'var(--border-w) solid var(--text)' },
  // Forced colours drop the tints: framed cells, filled in steps of the text colour.
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    background: 'Canvas',
    outline: 'var(--border-w) solid GrayText',
    outlineOffset: '-1px',
    '&[data-level="1"]': { background: 'color-mix(in srgb, CanvasText 35%, Canvas)' },
    '&[data-level="2"]': { background: 'color-mix(in srgb, CanvasText 65%, Canvas)' },
    '&[data-level="3"]': { background: 'CanvasText' },
  },
})
const swatchStyle = css({ width: 'var(--space-2_5)', height: 'var(--space-2_5)', '&:hover': { outline: 'none' } })
const footStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
})
const captionStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const legendStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--dim)',
})
