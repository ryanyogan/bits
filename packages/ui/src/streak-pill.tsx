import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'

export interface StreakPillProps {
  /** Consecutive active days. */
  days: number
  mix?: MixInput<HTMLElement>
}

/** Streak flame + day count (components §4.2; never the AppBar, decision 048). Static. */
export function StreakPill(handle: Handle<StreakPillProps>) {
  return () => {
    let { days, mix } = handle.props
    return (
      <span mix={[pillStyle, mix]}>
        <Icon name="flame" />
        <span aria-hidden="true">{days}</span>
        <span class="sr-only">{`${days}-day streak`}</span>
      </span>
    )
  }
}

const pillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1,
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
})
