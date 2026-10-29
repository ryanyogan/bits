import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

export interface PageFrameProps {
  /** `div` (default) or `main` when the frame is the page's main landmark. */
  as?: 'div' | 'main'
  id?: string
  /** Draw the two vertical rails (default). Off, it is just the centred column. */
  rails?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The ruled page column (decision 047): a centred box, `--frame-max` wide
 * at most and `--frame-inset` in from each screen edge, bounded by two
 * hairline rails (`--line-rail`) that run the full height of the page.
 *
 * Everything else in the grid hangs off it. Put `RuledSection`s inside, in
 * order: each draws a full-bleed rule above itself and a `Crosshair` where
 * that rule crosses a rail. Put a flush `CellGrid` inside a section to fill
 * the column rail to rail. A sticky header can live inside too; the rails
 * then run through it.
 *
 * Static and server-rendered. The rails are the frame's own inline
 * borders, so they need no extra element and never shift layout.
 */
export function PageFrame(handle: Handle<PageFrameProps>) {
  return () => {
    let { as = 'div', id, rails = true, mix, children } = handle.props
    let styles = [frameStyle, rails ? railStyle : undefined, mix]
    if (as === 'main') {
      return (
        <main id={id} tabIndex={-1} mix={styles}>
          {children}
        </main>
      )
    }
    return (
      <div id={id} mix={styles}>
        {children}
      </div>
    )
  }
}

const frameStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  width: 'min(calc(100% - 2 * var(--frame-inset)), var(--frame-max))',
  marginInline: 'auto',
  // A <main> frame takes focus from the skip link; the outline would draw
  // round the whole page.
  '&:focus': { outline: 'none' },
})

const railStyle = css({
  borderInline: 'var(--border-w) solid var(--line-rail)',
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})
