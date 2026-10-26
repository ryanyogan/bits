import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface StatTileProps {
  value: RemixNode
  label: string
  /** Value colour token, e.g. `var(--volt)`. Defaults to text. */
  color?: string
  /** `main` (landing showcase, 24px, well) or `profile` (30px, surface + border). */
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
        <span mix={[labelStyle, main ? mainLabel : profileLabel]}>{label}</span>
      </div>
    )
  }
}

const tileStyle = css({ display: 'flex', flexDirection: 'column', minWidth: 0 })
const mainTile = css({ padding: 'var(--space-3_5)', borderRadius: 'var(--radius-12)', background: 'var(--well)', gap: 'var(--space-1)' })
const profileTile = css({
  padding: 'var(--space-4_5)',
  borderRadius: 'var(--radius-16)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  gap: 'var(--space-1_5)',
})
const valueStyle = css({ fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 'normal', color: 'var(--text)' })
const mainValue = css({ fontSize: 'var(--fs-24)' })
const profileValue = css({ fontSize: 'var(--fs-30)' })
const labelStyle = css({ color: 'var(--muted)' })
const mainLabel = css({ fontSize: 'var(--fs-13)' })
const profileLabel = css({ fontSize: 'var(--fs-14)' })
