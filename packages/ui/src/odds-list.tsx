import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

export interface OddsRow {
  token: string
  /** Probability 0–1. */
  p: number
  /** The token that was sampled (volt bar, "picked" label). */
  picked?: boolean
}

export interface OddsListProps {
  rows: OddsRow[]
  /** Accessible name of the list. */
  label?: string
  /** Colour the first row as the favourite (ion), as `OddsBars` does. */
  top?: boolean
  mix?: MixInput<HTMLElement>
}

/** `0.62` → "62%", small values keep one decimal. */
export function formatOdds(p: number): string {
  return `${(p * 100).toFixed(p >= 0.1 || p === 0 ? 0 : 1)}%`
}

/** Visible whitespace for a token on its own (" Paris" → "␣Paris"). */
export function showToken(token: string): string {
  return token.replace(/ /g, '␣').replace(/\n/g, '↵')
}

/**
 * The next-token bars (components §10.12): token, bar, percentage. Static;
 * `OddsBars` and `NextTokenPlayer` render it with their own numbers.
 */
export function OddsList(handle: Handle<OddsListProps>) {
  return () => {
    let { rows, label = 'Next-token probabilities', top = true, mix } = handle.props
    return (
      <ul aria-label={label} mix={[barsStyle, mix]}>
        {rows.map((row, index) => (
          <li key={row.token} data-picked={row.picked ? 'true' : undefined} mix={rowStyle}>
            <span mix={tokenStyle}>{row.token}</span>
            <span aria-hidden="true" mix={trackStyle}>
              <span
                mix={[fillStyle, row.picked ? pickedFill : top && index === 0 ? topFill : otherFill]}
                style={{ width: `${Math.max(1, row.p * 100).toFixed(1)}%` }}
              />
            </span>
            <span mix={pctStyle}>
              {formatOdds(row.p)}
              {row.picked ? <span class="sr-only"> (picked)</span> : null}
            </span>
          </li>
        ))}
      </ul>
    )
  }
}

const NARROW = '@media (max-width: 480px)'

const barsStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2_5)' })
const rowStyle = css({
  display: 'grid',
  gridTemplateColumns: '88px 1fr 56px',
  gap: 'var(--space-3)',
  alignItems: 'center',
  [NARROW]: { gridTemplateColumns: '64px 1fr 44px' },
})
const tokenStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-15)',
  whiteSpace: 'pre',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: 'var(--text)',
})
const trackStyle = css({ display: 'block', height: '22px', borderRadius: 'var(--radius-xs)', background: 'var(--fill-seg)', overflow: 'hidden' })
const fillStyle = css({
  display: 'block',
  height: '100%',
  borderRadius: 'var(--radius-xs)',
  transition: 'width var(--duration-sigil) var(--ease-out), background-color var(--duration-fast)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
const topFill = css({ background: 'var(--ion)' })
const otherFill = css({ background: 'var(--ion-a45)' })
const pickedFill = css({ background: 'var(--volt)' })
const pctStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--text-quiet)', textAlign: 'right' })
