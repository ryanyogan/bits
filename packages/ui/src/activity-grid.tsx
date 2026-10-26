import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

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
  mix?: MixInput<HTMLElement>
}

/**
 * 26-week heatmap (components §11.3). One `role="img"` with a summary label;
 * the grid scrolls inside its card at narrow widths. Static.
 */
export function ActivityGrid(handle: Handle<ActivityGridProps>) {
  return () => {
    let { levels, label, heading = 'ACTIVITY · LAST 26 WEEKS', headingLevel = 3, titles, mix } = handle.props
    return (
      <section aria-label="Activity" mix={[cardStyle, mix]}>
        <div mix={headerStyle}>
          {headingLevel === 2 ? <h2 mix={headingStyle}>{heading}</h2> : <h3 mix={headingStyle}>{heading}</h3>}
          <div aria-hidden="true" mix={legendStyle}>
            less
            {([0, 1, 2, 3] as const).map((level) => (
              <span key={level} data-level={level} mix={[cellStyle, swatchStyle]} />
            ))}
            more
          </div>
        </div>
        <div mix={scrollStyle} tabIndex={0} aria-label="Activity heatmap, scrollable">
          <div role="img" aria-label={label} mix={gridStyle}>
            {levels.map((level, index) => (
              <span key={index} data-level={level} title={titles?.[index]} mix={cellStyle} />
            ))}
          </div>
        </div>
      </section>
    )
  }
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

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-5_5)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  minWidth: 0,
})
const headerStyle = css({ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' })
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
const legendStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  color: 'var(--muted)',
})
// row-reverse starts the scroll position at the right end (the latest week)
// when the grid overflows on narrow screens (§11.3), with no JS; `safe`
// keeps it left-aligned when it fits.
const scrollStyle = css({
  display: 'flex',
  flexDirection: 'row-reverse',
  justifyContent: 'safe flex-end',
  overflowX: 'auto',
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(26, 14px)',
  gridTemplateRows: 'repeat(7, 14px)',
  gridAutoFlow: 'column',
  gap: 'var(--space-1)',
  minWidth: 'max-content',
})
const cellStyle = css({
  borderRadius: 'var(--radius-3)',
  background: 'var(--fill-seg)',
  '&[data-level="1"]': { background: 'var(--volt-a25)' },
  '&[data-level="2"]': { background: 'var(--volt-a55)' },
  '&[data-level="3"]': { background: 'var(--volt)' },
  '&:hover': { outline: '1px solid var(--text)' },
})
const swatchStyle = css({ width: '12px', height: '12px', '&:hover': { outline: 'none' } })
