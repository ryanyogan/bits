import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface StatTileProps {
  value: RemixNode
  label: string
  /** Value colour token, e.g. `var(--volt)`. Defaults to text. On `profile` it also draws a small square before the label. */
  color?: string
  /**
   * `main` (landing showcase, 24px) or `profile` (the dashboard's stat
   * cells, 34px, mono label). Both are flat and borderless: put them in a
   * `CellGrid`, which draws the shared hairlines (decision 047).
   */
  variant?: 'main' | 'profile'
  mix?: MixInput<HTMLElement>
}

/** A number + label tile (components §8.5). Value first, then label, in reading order. Static. */
export function StatTile(handle: Handle<StatTileProps>) {
  return () => {
    let { value, label, color, variant = 'profile', mix } = handle.props
    let main = variant === 'main'
    return (
      <div mix={[tileStyle, main ? mainTile : profileTile, mix]}>
        <span mix={[valueStyle, main ? mainValue : profileValue]} style={color ? { color } : undefined}>
          {value}
        </span>
        <span mix={[labelStyle, main ? mainLabel : profileLabel]}>
          {!main && color ? <span aria-hidden="true" mix={markStyle} style={{ background: color }} /> : null}
          {label}
        </span>
      </div>
    )
  }
}

const PHONE = '@media (max-width: 480px)'

const tileStyle = css({ display: 'flex', flexDirection: 'column', minWidth: 0 })
const mainTile = css({ padding: 'var(--space-3_5)', gap: 'var(--space-1)' })
const profileTile = css({
  padding: 'var(--space-6) var(--cell-pad)',
  gap: 'var(--space-2)',
  [PHONE]: { padding: 'var(--space-5) var(--space-4)' },
})
const valueStyle = css({ fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 'normal', color: 'var(--text)' })
const mainValue = css({ fontSize: 'var(--fs-24)' })
const profileValue = css({
  fontSize: 'var(--fs-34)',
  lineHeight: 1.05,
  letterSpacing: 'var(--tracking-title)',
  fontVariantNumeric: 'tabular-nums',
  [PHONE]: { fontSize: 'var(--fs-28)' },
})
const labelStyle = css({ color: 'var(--muted)' })
const mainLabel = css({ fontSize: 'var(--fs-13)' })
const profileLabel = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1.4,
})
// The colour key: a small square in the value's colour, a signal, not a
// fill. Decorative, so forced colours may drop it.
const markStyle = css({
  flex: 'none',
  width: 'var(--space-2)',
  height: 'var(--space-2)',
})
