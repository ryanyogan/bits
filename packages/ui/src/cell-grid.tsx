import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FOCUS, FORCED_COLORS, HOVER } from './lib/states.ts'

export type CellGridCols = 1 | 2 | 3 | 4
export type CellGridEdge = 'flush' | 'boxed'
export type CellGridFill = 'none' | 'ink'

export interface CellGridProps {
  /** Columns from 1024px up. */
  cols?: CellGridCols
  /** Columns from 760 to 1023px (default: 2, or 3 for a 3-column grid). */
  colsMid?: CellGridCols
  /** Columns under 760px (default 1). More only for small cells, such as a row of stats. */
  colsPhone?: CellGridCols
  /**
   * `flush` (default) draws only the borders between cells and one along
   * each cell's top, for a grid that fills a `PageFrame` rail to rail (the
   * rails and the next section's rule close it). `boxed` adds the outside
   * edges, for a grid that sits inside padding.
   */
  edge?: CellGridEdge
  /** `ink` gives every cell the nearly opaque `--cell-fill` (over the landing's field). */
  fill?: CellGridFill
  /** Pad each cell with `--cell-pad` (default). Off when the cells pad themselves. */
  pad?: boolean
  /** `ul` / `ol` (children are `<li>`), or `div`. */
  as?: 'ul' | 'ol' | 'div'
  'aria-label'?: string
  'aria-labelledby'?: string
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * Cells that share 1px borders (decision 047): no gaps, no cards, one
 * hairline (`--line-cell`) between neighbours. Every direct child is a
 * cell. Each cell draws its top border and, unless it ends a row, its
 * right one, so no line is ever drawn twice (translucent lines would
 * double). Responsive with no JS: `cols` from 1024px, `colsMid` from 760px,
 * `colsPhone` (default 1) below that.
 *
 * A whole-cell link: give the `<a>` `cellLinkStyle`. Static.
 */
export function CellGrid(handle: Handle<CellGridProps>) {
  return () => {
    let { cols = 3, colsMid, colsPhone = 1, edge = 'flush', fill = 'none', pad = true, as = 'div', mix, children } = handle.props
    let mid = colsMid ?? (cols === 3 ? 3 : Math.min(cols, 2))
    let styles = [
      gridStyle,
      layoutFor(cols, mid as CellGridCols, colsPhone),
      edge === 'boxed' ? boxedStyle : undefined,
      fill === 'ink' ? inkStyle : undefined,
      pad ? padStyle : undefined,
      mix,
    ]
    let a11y = { 'aria-label': handle.props['aria-label'], 'aria-labelledby': handle.props['aria-labelledby'] }
    if (as === 'ul') return <ul {...a11y} mix={styles}>{children}</ul>
    if (as === 'ol') return <ol {...a11y} mix={styles}>{children}</ol>
    return <div {...a11y} mix={styles}>{children}</div>
  }
}

const MID = '@media (min-width: 760px) and (max-width: 1023.98px)'
const WIDE = '@media (min-width: 1024px)'
const PHONE = '@media (max-width: 759.98px)'

const gridStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  '& > *': {
    minWidth: 0,
    boxSizing: 'border-box',
    borderTop: 'var(--border-w) solid var(--line-cell)',
    borderRight: 'var(--border-w) solid var(--line-cell)',
  },
  [FORCED_COLORS]: { '& > *': { borderColor: 'GrayText' } },
})

type CssInput = Parameters<typeof css>[0]

/** `n` equal columns; every nth cell ends a row, so it draws no right border. */
function columns(n: CellGridCols): CssInput {
  let rowEnd = `& > :nth-child(${n}n)`
  return { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, [rowEnd]: { borderRight: 0 } } as CssInput
}

const layouts = new Map<string, ReturnType<typeof css>>()
/** One mixin per (wide, mid, phone) triple: the column count and which cells end a row. */
function layoutFor(cols: CellGridCols, mid: CellGridCols, phone: CellGridCols) {
  let key = `${cols}/${mid}/${phone}`
  let style = layouts.get(key)
  if (!style) {
    style = css({ [WIDE]: columns(cols), [MID]: columns(mid), [PHONE]: columns(phone) })
    layouts.set(key, style)
  }
  return style
}

// The outside edges for a grid inside padding: the cells already draw the
// top; the last cell of each row has no right border, so the box draws it.
const boxedStyle = css({
  borderInline: 'var(--border-w) solid var(--line-cell)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})

const inkStyle = css({ '& > *': { background: 'var(--cell-fill)' } })

const padStyle = css({ '& > *': { padding: 'var(--cell-pad)' } })

/**
 * A link that is the whole cell: it cancels the cell's padding and takes
 * it on itself, so the hit area and the hover fill reach every edge. The
 * focus outline sits inside the cell, where the shared borders can't clip it.
 */
export const cellLinkStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: '100%',
  margin: 'calc(-1 * var(--cell-pad))',
  padding: 'var(--cell-pad)',
  boxSizing: 'content-box',
  color: 'var(--text)',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast) var(--ease)',
  [HOVER]: { color: 'var(--text)', background: 'var(--cell-fill-hover)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { [HOVER]: { textDecoration: 'underline' } },
})
