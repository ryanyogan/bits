// Layout and type styles shared by the landing page sections (Main.md).
import { css } from 'remix/component'

export const PHONE = '@media (max-width: 480px)'

/** `max-width:1280px; margin:0 auto; padding:120px 32px` → 72px 16px on phones. */
export const sectionStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-30) var(--page-gutter)',
  boxSizing: 'border-box',
  [PHONE]: { paddingTop: 'var(--space-18)', paddingBottom: 'var(--space-18)' },
})

/** Section column used by #path and the modes section. */
export const stackSection = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-14)',
  [PHONE]: { gap: 'var(--space-10)' },
})

/** Two-up grid that collapses at `min` width. */
export function splitGrid(min: string) {
  return css({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`,
    gap: 'var(--space-16)',
    alignItems: 'center',
    [PHONE]: { gap: 'var(--space-10)' },
  })
}

/** `h2-section`: Unbounded 700 clamp(36px, 4.6vw, 64px) / 1.02, -0.035em. */
export const h2Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
  textWrap: 'balance',
})

/** Section lead: 19/1.6 `--text-lead`. */
export const leadStyle = css({
  margin: 0,
  fontSize: 'var(--fs-19)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
})

export const voltText = css({ color: 'var(--volt)' })

/** Mono note under the hero and the closing CTA. */
export const monoNote = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--dim)',
})

/** Frosted glass over the field (components §8.4). */
export const glass = css({
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
  border: '1px solid var(--line-glass)',
})

/** Small card title: Unbounded 500 22px, -0.02em. */
export const cardTitle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-22)',
  letterSpacing: 'var(--tracking-title)',
})

/** Card description: 15/1.55 `--muted`. */
export const cardDesc = css({
  margin: 0,
  fontSize: 'var(--fs-15)',
  lineHeight: 1.55,
  color: 'var(--muted)',
})
