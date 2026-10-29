import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'

import { Icon } from './icon.tsx'
import { prefetchFor } from './lib/prefetch.ts'
import { ACTIVE, FORCED_COLORS, forcedSelected, HOVER } from './lib/states.ts'

export interface AppBarLink {
  href: string
  label: string
}

export interface AppBarMenuProps {
  links: AppBarLink[]
  currentPath?: string
  /** Accessible name of the nav inside the sheet. */
  label?: string
  /** id of the sheet; unique per page. */
  id?: string
}

/**
 * The narrow-screen (<760px) navigation: a menu button that opens a sheet of
 * nav links under the app bar (resolutions §8).
 *
 * The sheet is a native `popover="auto"` opened by `popovertarget`, so it
 * opens, closes on Escape or an outside click, restores focus and exposes
 * `aria-expanded` with JavaScript off. As a client entry it adds the one thing
 * the platform cannot: closing the sheet when a link inside it starts a
 * client-side (frame) navigation, which keeps the document and so would keep
 * the popover open.
 *
 * Props cross the server/browser boundary, so they stay serializable.
 */
export const AppBarMenu = clientEntry(
  import.meta.url,
  function AppBarMenu(handle: Handle<AppBarMenuProps>) {
    return () => {
      let { links, currentPath, label = 'Primary', id = 'app-nav-sheet' } = handle.props

      return (
        <div mix={menuStyle}>
          <button type="button" popovertarget={id} aria-label="Menu" mix={buttonStyle}>
            <Icon name="menu" />
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
            ]}
          >
            <nav aria-label={label} mix={sheetNavStyle}>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={link.href === currentPath ? 'page' : undefined}
                  data-rmx-prefetch={prefetchFor(link.href)}
                  mix={linkStyle}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )
    }
  },
)

const menuStyle = css({
  display: 'none',
  '@media (max-width: 759.98px)': { display: 'block' },
})

const buttonStyle = css({
  display: 'grid',
  placeItems: 'center',
  width: 'var(--touch-target)',
  height: 'var(--touch-target)',
  padding: 0,
  borderRadius: 'var(--radius-12)',
  border: 'var(--border-w) solid var(--line-strong)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  // The ghost-key recipe (Keycap ghost, BackButton): hover lifts the border, press fills.
  [HOVER]: { background: 'var(--fill-ghost-hover)', borderColor: 'var(--line-drop)' },
  [ACTIVE]: { background: 'var(--fill-btn)' },
})

const sheetStyle = css({
  // A full-width sheet that drops from under the bar's top row (the bar is
  // pinned at the top, `--appbar-h` tall; decision 022). It covers a lesson
  // sub-bar, and scrolls itself on a short screen.
  position: 'fixed',
  inset: 'var(--appbar-h) 0 auto 0',
  maxHeight: 'calc(100dvh - var(--appbar-h))',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  width: '100%',
  maxWidth: 'none',
  margin: 0,
  padding: 'var(--space-2) var(--page-gutter) var(--space-4)',
  border: 0,
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  background: 'var(--surface)',
  color: 'var(--text)',
  '&::backdrop': { background: 'var(--ink-a60)' },
  '&:popover-open': { animation: 'bits-rise var(--duration-reveal) var(--ease) both' },
  '@media (prefers-reduced-motion: reduce)': { '&:popover-open': { animation: 'none' } },
})

// The sheet is a column of cells: one hairline between links (decision 047).
const sheetNavStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& > a + a': { borderTop: 'var(--border-w) solid var(--line-cell)' },
})

const linkStyle = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--control-field)',
  padding: '0 var(--space-3)',
  color: 'var(--muted)',
  fontSize: 'var(--fs-15)',
  textDecoration: 'none',
  transition: 'background-color var(--duration-fast), color var(--duration-fast)',
  [HOVER]: { color: 'var(--text)', background: 'var(--fill-hover)' },
  [ACTIVE]: { background: 'var(--fill-btn)' },
  '&[aria-current="page"]': {
    color: 'var(--text)',
    background: 'var(--fill-ghost-hover)',
    boxShadow: 'inset var(--border-w-strong) 0 0 var(--volt)',
  },
  // The tint and the inset rule vanish in forced colours (decision 025).
  [FORCED_COLORS]: { '&[aria-current="page"]': forcedSelected },
})
