import { css } from 'remix/component'

/**
 * A section heading drawn as the grid's mono header strip (decision 047):
 * the look of `RuledSection`'s `label` strip, but a real `<h2>` so the
 * page outline keeps its headings. Put it first in a cell or band; the
 * hairline under it starts the content.
 */
export const stripHeading = css({
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--section-pad-x)',
  boxSizing: 'border-box',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 400,
  fontSize: 'var(--fs-12)',
  lineHeight: 1.4,
  color: 'var(--muted)',
  '@media (forced-colors: active)': { borderColor: 'GrayText' },
})
