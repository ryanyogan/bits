import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { ACTIVE, DISABLED, FOCUS, HOVER, type ForcedState } from './lib/states.ts'

export interface AvatarButtonProps {
  /** One or two letters, e.g. "JP". */
  initials: string
  href: string
  /** Marks the profile page itself (`aria-current="page"`, volt face). */
  current?: boolean
  label?: string
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
}

/**
 * The signed-in avatar link in app bars (components §4.3). 40px visual with a
 * 44px hit area (resolutions §7). Static.
 */
export function AvatarButton(handle: Handle<AvatarButtonProps>) {
  return () => {
    let { initials, href, current, label = 'Your profile', forceState, mix } = handle.props
    return (
      <a
        href={href}
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        data-force={forceState}
        mix={[avatarStyle, mix]}
      >
        <span aria-hidden="true">{initials}</span>
      </a>
    )
  }
}

const avatarStyle = css({
  position: 'relative',
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: '40px',
  height: '40px',
  borderRadius: 'var(--radius-12)',
  background: 'var(--raised)',
  border: '1px solid var(--line-strong)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  textDecoration: 'none',
  transition: 'border-color var(--duration-fast)',
  '&::before': { content: '""', position: 'absolute', inset: '-3px' },
  [HOVER]: { borderColor: 'var(--line-drop)' },
  '&[aria-current="page"]': {
    background: 'var(--volt)',
    color: 'var(--on-volt)',
    borderColor: 'var(--volt)',
  },
  [FOCUS]: { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
