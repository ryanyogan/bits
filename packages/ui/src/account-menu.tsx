import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { avatarStyle } from './avatar-button.tsx'
import { prefetchFor } from './lib/prefetch.ts'
import { ACTIVE, busyStyle, FOCUS, FORCED_COLORS, forcedSelected, HOVER } from './lib/states.ts'

export interface AccountMenuLink {
  href: string
  label: string
}

export interface AccountMenuProps {
  /** One or two letters, e.g. "JP": the button's face. */
  initials: string
  /** Who is signed in, shown at the top of the menu. */
  name: string
  /** e.g. "@jamie". */
  handle?: string
  /** The account's pages (My learning, Settings, …), in order. */
  links: AccountMenuLink[]
  /** `POST` here signs out (a native form, so it works without JS). */
  signOutAction: string
  /** Pathname of this page: marks its link and lights the button. */
  currentPath?: string
  /** id of the popover; unique per page. */
  id?: string
}

/**
 * The signed-in account menu in the app bar (decision 065): the avatar is
 * a button that opens a small sheet under the bar with who is signed in,
 * the account's pages and Sign out.
 *
 * Like `AppBarMenu`, the sheet is a native `popover="auto"` opened by
 * `popovertarget`, so it opens, closes on Escape or an outside click,
 * restores focus and exposes `aria-expanded` without JavaScript. Sign out is
 * a native POST form. As a client entry it only closes the sheet when a
 * link or the form inside it starts a client-side navigation, which keeps
 * the document (and so would keep the popover open).
 *
 * Props cross the server/browser boundary, so they stay serializable.
 */
export const AccountMenu = clientEntry(import.meta.url, function AccountMenu(handle: Handle<AccountMenuProps>) {
  return () => {
    let { initials, name, handle: at, links, signOutAction, currentPath, id = 'account-menu' } = handle.props
    let current = links.some((link) => link.href === currentPath)

    return (
      <div mix={wrapStyle}>
        <button
          type="button"
          popovertarget={id}
          // The name ends with the initials the button shows (WCAG 2.5.3; decision 031).
          aria-label={`Your profile, ${initials}`}
          data-current={current ? 'true' : undefined}
          mix={[avatarStyle, buttonStyle]}
        >
          <span aria-hidden="true">{initials}</span>
        </button>
        <div
          id={id}
          popover="auto"
          mix={[
            sheetStyle,
            on('click', (event) => {
              let target = event.target as Element | null
              if (target?.closest('a')) event.currentTarget.hidePopover()
            }),
            on('submit', (event) => {
              event.currentTarget.hidePopover()
            }),
          ]}
        >
          <p mix={whoStyle}>
            <span mix={nameStyle}>{name}</span>
            {at ? <span mix={handleStyle}>{at}</span> : null}
          </p>
          <nav aria-label="Account" mix={listStyle}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === currentPath ? 'page' : undefined}
                data-rmx-prefetch={prefetchFor(link.href)}
                mix={rowStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <form method="post" action={signOutAction} mix={formStyle}>
            <button type="submit" mix={[rowStyle, signOutStyle, busyStyle]}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    )
  }
})

const wrapStyle = css({ display: 'flex' })

const buttonStyle = css({
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--fs-13)',
})

// A small sheet under the bar, against the frame's right rail (decision
// 047: flat surface, one hairline, square corners, no shadow).
const sheetStyle = css({
  position: 'fixed',
  inset: 'var(--appbar-h) auto auto auto',
  right: 'max(var(--frame-inset), (100% - var(--frame-max)) / 2)',
  width: 'min(var(--account-menu-width), calc(100% - 2 * var(--frame-inset)))',
  maxHeight: 'calc(100dvh - var(--appbar-h))',
  overflowY: 'auto',
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  border: 'var(--border-w) solid var(--line-strong)',
  borderTop: 0,
  background: 'var(--surface)',
  color: 'var(--text)',
  '&:popover-open': { animation: 'bits-rise var(--duration-reveal) var(--ease) both' },
  '@media (prefers-reduced-motion: reduce)': { '&:popover-open': { animation: 'none' } },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
})

const whoStyle = css({
  margin: 0,
  padding: 'var(--space-4) var(--space-4) var(--space-3)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  minWidth: 0,
})

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

const nameStyle = css({ ...ellipsis, fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text)' })
const handleStyle = css({ ...ellipsis, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })

// A column of cells: one hairline between rows.
const listStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& > a + a': { borderTop: 'var(--border-w) solid var(--line-cell)' },
})

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  color: 'var(--text-lead)',
  fontSize: 'var(--fs-15)',
  textAlign: 'start',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast), color var(--duration-fast)',
  [HOVER]: { color: 'var(--text)', background: 'var(--fill-hover)' },
  [ACTIVE]: { background: 'var(--fill-btn)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '&[aria-current="page"]': {
    color: 'var(--text)',
    background: 'var(--fill-ghost-hover)',
    boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt)',
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  // The tint and the inset rule vanish in forced colours (decision 025).
  [FORCED_COLORS]: { '&[aria-current="page"]': forcedSelected, [HOVER]: { textDecoration: 'underline' } },
})

const formStyle = css({ margin: 0, borderTop: 'var(--border-w) solid var(--line-cell)' })

const signOutStyle = css({
  appearance: 'none',
  border: 0,
  background: 'none',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 'var(--fs-15)',
  color: 'var(--muted)',
})
