import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'

export interface XpPillProps {
  /** Neurons earned. Formatted with en-US grouping (1,240). */
  neurons: number
  mix?: MixInput<HTMLElement>
}

/** Neurons (XP) pill for app bars (components §4.1). Static. */
export function XpPill(handle: Handle<XpPillProps>) {
  return () => {
    let { neurons, mix } = handle.props
    let value = neurons.toLocaleString('en-US')
    return (
      <span mix={[pillStyle, mix]}>
        <Icon name="hex" />
        <span>{value}</span>
        <span class="sr-only"> neurons</span>
      </span>
    )
  }
}

const pillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--volt-a08)',
  border: 'var(--border-w) solid var(--volt-a25)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1,
  color: 'var(--volt-soft)',
  whiteSpace: 'nowrap',
})
