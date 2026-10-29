import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

export interface PageFrameProps {
  /** `div` (default) or `main` when the frame is the page's main landmark. */
  as?: 'div' | 'main'
  id?: string
  /**
   * Draw the frame's own continuous rails, top to bottom. Off by default
   * (decision 050): a page built from `RuledSection`s gets a pair of rails
   * per section, and the ground shows between them. On for a frame that
   * holds one continuous workspace with no sections (the lesson page).
   */
  rails?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * The ruled page column (decisions 047, 050): a centred box, `--frame-max`
 * wide at most and `--frame-inset` in from each screen edge.
 *
 * Put `RuledSection`s inside, in order. Each one is a framed plate: its
 * own two hairline rails (`--line-rail`), a full-bleed rule above and
 * below, and a `Crosshair` at each corner. Plates sit `--section-gap`
 * apart, and the page's ground (the field on the landing, ink elsewhere)
 * shows in the stripe between them and under the last one (the frame's
 * bottom padding). A section with `rule={false}` continues the block above
 * it instead: no gap and no rule of its own. A sticky header can live
 * inside too, with rails of its own.
 *
 * Static and server-rendered. Rails are borders, so they never shift
 * layout.
 */
export function PageFrame(handle: Handle<PageFrameProps>) {
  return () => {
    let { as = 'div', id, rails = false, mix, children } = handle.props
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
  paddingBottom: 'var(--section-gap)',
  // A <main> frame takes focus from the skip link; the outline would draw
  // round the whole page.
  '&:focus': { outline: 'none' },
})

const railStyle = css({
  borderInline: 'var(--border-w) solid var(--line-rail)',
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})
