import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

export type CrosshairPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

export interface CrosshairProps {
  /** Which corner of the positioned parent the mark sits on. */
  placement: CrosshairPlacement
  mix?: MixInput<HTMLElement>
}

/**
 * A small "+" where a horizontal rule meets a `PageFrame` rail (decision
 * 047): the grid's one bit of ornament. Decorative, so `aria-hidden`.
 *
 * Put it inside a positioned element that sits just inside the rails (a
 * `RuledSection` places its own). The mark is `--mark-size` square, an odd
 * number, so its 1px arms land on the rail's and the rule's pixels:
 * `start`/`end` centre it on the left/right rail, `top`/`bottom` on a 1px
 * rule along that edge.
 */
export function Crosshair(handle: Handle<CrosshairProps>) {
  return () => {
    let { placement, mix } = handle.props
    return <span aria-hidden="true" mix={[markStyle, placements[placement], mix]} />
  }
}

// (size - 1) / 2 puts the 1px arm on the edge's first pixel row/column; a
// rail sits just outside the parent's box, so start/end go one pixel further.
const along = 'calc((var(--mark-size) - 1px) / -2)'
const across = 'calc((var(--mark-size) + 1px) / -2)'

const markStyle = css({
  position: 'absolute',
  zIndex: 2,
  width: 'var(--mark-size)',
  height: 'var(--mark-size)',
  pointerEvents: 'none',
  background:
    'linear-gradient(var(--mark-cross), var(--mark-cross)) center / var(--border-w) 100% no-repeat, linear-gradient(var(--mark-cross), var(--mark-cross)) center / 100% var(--border-w) no-repeat',
  [FORCED_COLORS]: { display: 'none' },
})

const placements: Record<CrosshairPlacement, ReturnType<typeof css>> = {
  'top-start': css({ top: along, left: across }),
  'top-end': css({ top: along, right: across }),
  'bottom-start': css({ bottom: along, left: across }),
  'bottom-end': css({ bottom: along, right: across }),
}
