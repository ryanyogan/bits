import { css } from 'remix/component'

/**
 * Shared bits of the authoring and admin pages on the squared grid
 * (decision 047). Each page is a `PageFrame`: a `PageHead` band, then
 * `RuledSection`s whose content fills the column rail to rail.
 */

/** Inline `<code>` in an authoring lead: mono, and volt for `:::blocks`. */
export const authorLeadCode = css({
  '& code': { fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  '& code[data-tone="volt"]': { color: 'var(--volt)' },
})

/** A cell's own padding, for content that sits flush in a band (`pad="none"`). */
export const cellPad = css({
  padding: 'var(--space-8) var(--section-pad-x)',
  '@media (max-width: 480px)': { padding: 'var(--space-6) var(--section-pad-x)' },
})

/** A mono link in a band's strip (`aside`), like "Manage authors →". */
export const stripLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
  textDecoration: 'none',
  '&:hover': { color: 'var(--volt-link-hover)', textDecoration: 'underline' },
})
