// Layout and type styles shared by the landing page sections (Main.md,
// squared grid: decision 047). The grid itself (frame, rules, cells) comes
// from @bits/ui's PageFrame / RuledSection / CellGrid; this file only has
// the landing's type roles.
import { css } from 'remix/component'

export const PHONE = '@media (max-width: 480px)'
export const REDUCED = '@media (prefers-reduced-motion: reduce)'
export const FORCED = '@media (forced-colors: active)'

/**
 * The " · " between two phrases of a mono note. On phones the note breaks
 * here instead of mid-phrase; the dot stays in the text (size 0, a block
 * of its own), so it is still read out.
 */
export const dotBreak = css({ [PHONE]: { display: 'block', height: 0, overflow: 'hidden', fontSize: 0 } })

/** `h2-section`: Unbounded 700, 56px at 1440 (`--type-h2-landing-size`, decision 048) / 1.02, -0.035em. */
export const h2Style = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-h2-landing-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
  textWrap: 'balance',
  // Inside the rails a phone column is ~280px: Unbounded at 36px broke
  // "conversation." mid-word.
  [PHONE]: { fontSize: 'var(--fs-30)' },
})

/** Section lead: 18/1.6 `--text-lead`. */
export const leadStyle = css({
  margin: 0,
  maxWidth: '52ch',
  fontSize: 'var(--fs-18)',
  lineHeight: 1.6,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
  [PHONE]: { fontSize: 'var(--fs-17)' },
})

export const voltText = css({ color: 'var(--volt)' })

/** Mono note under the hero and the closing CTA. */
export const monoNote = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--dim)',
})

/** A section's intro: heading and lead stacked, left-aligned. */
export const introStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  maxWidth: 'var(--read-width)',
})

/** Small card title: Unbounded 500 22px, -0.02em. */
export const cardTitle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--fs-22)',
  lineHeight: 1.15,
  letterSpacing: 'var(--tracking-title)',
})

/** Card description: 15/1.55 `--muted`. */
export const cardDesc = css({
  margin: 0,
  fontSize: 'var(--fs-15)',
  lineHeight: 1.55,
  color: 'var(--muted)',
})

/** A mono label inside a cell: "Text · always", a track name. Sentence case, like the strips (047, 048). */
export const cellLabel = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
})
