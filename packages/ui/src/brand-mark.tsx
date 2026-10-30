import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS, forcedSvgPaint } from './lib/states.ts'

export interface BrandMarkProps {
  /** Rendered size in px. */
  size?: number
}

/**
 * The bits brand mark (decision 058): a 3×3 lattice of bit cells, four of
 * them lit (the same four positions the old node-graph mark used: top-left,
 * bottom-left, right-middle, bottom-right) and the last one volt. The five
 * unlit cells stay as a faint lattice, so the glyph reads as bits in a
 * field, not as four loose squares. Square cells, no edges: at 16px (the
 * favicon) edges turn to mud, and the lattice already says "graph".
 *
 * Decorative; pair it with the wordmark. `apps/web/public/favicon.svg` is
 * the same drawing on an ink square (keep them in step).
 */
export function BrandMark(handle: Handle<BrandMarkProps>) {
  return () => {
    let size = handle.props.size ?? 30
    return (
      <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true" mix={markStyle}>
        <g fill="var(--text)" fill-opacity="0.16" data-off="">
          <rect x="11" y="1" width="8" height="8" />
          <rect x="21" y="1" width="8" height="8" />
          <rect x="1" y="11" width="8" height="8" />
          <rect x="11" y="11" width="8" height="8" />
          <rect x="11" y="21" width="8" height="8" />
        </g>
        <g fill="var(--text)">
          <rect x="1" y="1" width="8" height="8" />
          <rect x="1" y="21" width="8" height="8" />
          <rect x="21" y="11" width="8" height="8" />
        </g>
        <rect x="21" y="21" width="8" height="8" fill="var(--volt)" />
      </svg>
    )
  }
}

// Forced colours paint every cell in the text colour; the unlit lattice
// keeps a lower opacity so the lit bits still stand out from it.
const markStyle = css({ flex: 'none', [FORCED_COLORS]: { ...forcedSvgPaint, '& [data-off]': { fillOpacity: 0.35 } } })
