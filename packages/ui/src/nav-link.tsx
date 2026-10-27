import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { ACTIVE, DISABLED, FOCUS, FORCED_COLORS, HOVER, type ForcedState } from './lib/states.ts'

export type NavLinkVariant = 'app' | 'marketing' | 'footer'

export interface NavLinkProps {
  href: string
  /** `app` (muted, app bars), `marketing` (lead grey, landing), `footer` (14px). */
  variant?: NavLinkVariant
  /** Marks the current page: text colour + 2px volt underline (`aria-current="page"`). */
  current?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** A navigation text link with a 44px hit height (components §3.2). Static. */
export function NavLink(handle: Handle<NavLinkProps>) {
  return () => {
    let { href, variant = 'app', current, forceState, mix, children } = handle.props
    return (
      <a
        href={href}
        aria-current={current ? 'page' : undefined}
        data-force={forceState}
        mix={[navLinkStyle, navLinkVariants[variant], mix]}
      >
        {children}
      </a>
    )
  }
}

export const navLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  boxSizing: 'border-box',
  fontSize: 'var(--fs-15)',
  textDecoration: 'none',
  borderBottom: '2px solid transparent',
  borderTop: '2px solid transparent',
  transition: 'color var(--duration-fast)',
  [HOVER]: { color: 'var(--text)' },
  [FOCUS]: { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px', borderRadius: 'var(--radius-4)' },
  '&[aria-current="page"]': { color: 'var(--text)', borderBottomColor: 'var(--volt)' },
  // Forced colours paint the transparent borders, which underlined every
  // link: hide them in the canvas colour and mark only the current page.
  [FORCED_COLORS]: { borderColor: 'Canvas', '&[aria-current="page"]': { borderBottomColor: 'Highlight' } },
})

export const navLinkVariants: Record<NavLinkVariant, ReturnType<typeof css>> = {
  app: css({ color: 'var(--muted)' }),
  marketing: css({ color: 'var(--text-lead)' }),
  footer: css({ color: 'var(--text-lead)', fontSize: 'var(--fs-14)' }),
}
