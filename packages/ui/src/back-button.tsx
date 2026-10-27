import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'
import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
import { FOCUS, HOVER, type ForcedState } from './lib/states.ts'

export interface BackButtonProps {
  href: string
  /** Accessible name, e.g. "Back to course". */
  label: string
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
}

/** 44px chevron link in the lesson bars (components §3.4). Static. */
export function BackButton(handle: Handle<BackButtonProps>) {
  return () => {
    let { href, label, prefetch, forceState, mix } = handle.props
    return (
      <a href={href} data-rmx-prefetch={prefetchFor(href, prefetch)} aria-label={label} data-force={forceState} mix={[buttonStyle, mix]}>
        <Icon name="chevron-left" />
      </a>
    )
  }
}

const buttonStyle = css({
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: 'var(--touch-target)',
  height: 'var(--touch-target)',
  borderRadius: 'var(--radius-12)',
  border: '1px solid var(--line-strong)',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  [HOVER]: { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
  [FOCUS]: { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
