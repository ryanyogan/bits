import { css } from 'remix/component'

/**
 * The page column every app page sits in (decision 043): the 1280px container,
 * centred, with the page gutter at the sides and the same top and bottom
 * spacing on every page: 56/96px, 32/64px on phones (≤480px, where
 * `--page-gutter` is already 16px). Layout's `<main>` uses it, and so does each
 * `bleed` page's own column (course, settings, author, the not-found pages),
 * so moving from one page to another doesn't shift the content.
 *
 * Compose page-specific layout (display, gap) alongside it:
 * `mix={[pageShell, columnStyle]}`. It sets only the box's size and spacing,
 * so the two never set the same property.
 */
export const pageShell = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--page-gutter) var(--space-16)' },
})
