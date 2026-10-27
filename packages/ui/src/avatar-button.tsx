import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
import { ACTIVE, DISABLED, FOCUS, focusOutline, HOVER, type ForcedState } from './lib/states.ts'

export interface AvatarButtonProps {
  /** One or two letters, e.g. "JP". */
  initials: string
  href: string
  /** Marks the profile page itself (`aria-current="page"`, volt face). */
  current?: boolean
  label?: string
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
}

/**
 * The signed-in avatar link in app bars (components §4.3). 40px visual with a
 * 44px hit area (resolutions §7). Static.
 */
export function AvatarButton(handle: Handle<AvatarButtonProps>) {
  return () => {
    let { initials, href, current, label = 'Your profile', prefetch, forceState, mix } = handle.props
    return (
      <a
        href={href}
        // The name ends with the initials the link shows, so voice control can
        // target what it sees (WCAG 2.5.3; decision 031).
        aria-label={`${label}, ${initials}`}
        aria-current={current ? 'page' : undefined}
        data-rmx-prefetch={prefetchFor(href, prefetch)}
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
  width: 'var(--control-compact)',
  height: 'var(--control-compact)',
  borderRadius: 'var(--radius-12)',
  background: 'var(--raised)',
  border: 'var(--border-w) solid var(--line-strong)',
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
  [FOCUS]: focusOutline,
})
