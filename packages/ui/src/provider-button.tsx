import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { Icon, type IconName } from './icon.tsx'
import { ACTIVE, busyStyle, DISABLED, FOCUS, focusOutline, HOVER, type ForcedState } from './lib/states.ts'

export interface ProviderButtonProps {
  /** `github` / `globe` (Google) / `key` (passkey). */
  icon: IconName
  /**
   * OAuth start URL: renders a link that works without JS. It is a document
   * navigation (`data-rmx-document`): the redirect leaves the origin, which
   * client navigation can't follow. Omit for a button (passkey).
   */
  href?: string
  type?: 'button' | 'submit'
  name?: string
  value?: string
  /** "Waiting for passkey…" state. */
  busy?: boolean
  disabled?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Full-width sign-in method button (components §5.4). Static; passkey behaviour is the page's island. */
export function ProviderButton(handle: Handle<ProviderButtonProps>) {
  return () => {
    let { icon, href, type = 'button', name, value, busy, disabled, forceState, mix, children } = handle.props
    let content = (
      <>
        <Icon name={icon} />
        <span>{children}</span>
      </>
    )
    if (href) {
      return (
        <a href={href} data-rmx-document="" data-force={forceState} mix={[buttonStyle, mix]}>
          {content}
        </a>
      )
    }
    return (
      <button
        type={type}
        name={name}
        value={value}
        disabled={disabled}
        aria-busy={busy ? 'true' : undefined}
        data-force={forceState}
        mix={[buttonStyle, busyStyle, mix]}
      >
        {content}
      </button>
    )
  }
}

const buttonStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3)',
  width: '100%',
  minHeight: 'var(--control-field)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: 'var(--border-w) solid var(--line-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-15)',
  fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  [HOVER]: { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)', color: 'var(--text)' },
  [ACTIVE]: { background: 'var(--fill-btn)' },
  [FOCUS]: focusOutline,
  // The ghost-key disabled recipe (Keycap ghost): dim text on a quiet border.
  [DISABLED]: { color: 'var(--dim)', borderColor: 'var(--line)', cursor: 'not-allowed' },
})
