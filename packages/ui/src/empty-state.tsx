import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { BitCells } from './bit-cells.tsx'
import { FORCED_COLORS } from './lib/states.ts'

export interface EmptyStateProps {
  title: RemixNode
  hint?: RemixNode
  /** Usually a ghost Keycap ("Clear filters"). */
  action?: RemixNode
  /**
   * `boxed` (default): a flat hairline box with a row of four unlit bits
   * (`0000`, decision 058) before the title, for a list that is empty
   * inside a padded cell or panel. `bare`: no box, for a state that fills
   * a grid cell or ruled band on its own (decision 047).
   */
  variant?: 'boxed' | 'bare'
  mix?: MixInput<HTMLElement>
}

/**
 * Empty state (components §8.7, on the squared grid of decision 047):
 * "0 results for “x”", a hint and an optional action, aligned to the
 * cell's left edge like everything else in the grid. Static.
 */
export function EmptyState(handle: Handle<EmptyStateProps>) {
  return () => {
    let { title, hint, action, variant = 'boxed', mix } = handle.props
    return (
      <div mix={[baseStyle, variant === 'bare' ? bareStyle : boxedStyle, mix]}>
        <p mix={titleStyle}>
          {variant === 'boxed' ? <BitCells bits="0000" size={7} mix={markStyle} /> : null}
          {title}
        </p>
        {hint ? <p mix={hintStyle}>{hint}</p> : null}
        {action ? <div mix={actionStyle}>{action}</div> : null}
      </div>
    )
  }
}

const baseStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-2)',
  textAlign: 'start',
})
const boxedStyle = css({
  padding: 'var(--space-6) var(--cell-pad)',
  border: 'var(--border-w) solid var(--line-cell)',
  background: 'var(--well)',
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})
const bareStyle = css({ padding: 'var(--space-12) var(--cell-pad)' })
const titleStyle = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text)',
})
const markStyle = css({ color: 'var(--dim)' })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.5, color: 'var(--muted)' })
const actionStyle = css({ marginTop: 'var(--space-2)' })
