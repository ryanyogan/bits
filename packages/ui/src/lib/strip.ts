import { css } from 'remix/component'

import { FORCED_COLORS } from './states.ts'

/**
 * The grid's mono header strip (decision 047), shared by `RuledSection`
 * and `Panel`: a 44px row at the cell inset with a label at the start, an
 * aside at the end, and the hairline under it. The strip always draws that
 * hairline, so what follows it never draws a top border of its own (a
 * `CellGrid` right under a strip takes `top={false}`).
 */
export const stripStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--cell-pad)',
  boxSizing: 'border-box',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})

/** The strip's label: a `<p>` or a real heading, drawn the same either way. */
export const stripLabelStyle = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  fontWeight: 400,
  lineHeight: 1.4,
  letterSpacing: 'normal',
  color: 'var(--muted)',
})

export const stripAsideStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})

/** A mono link for a strip's aside ("All 12 →"), raised to the 44px touch target. */
export const stripLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  margin: 'calc((var(--touch-target) - 1lh) / -2) 0',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
})
