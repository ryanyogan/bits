import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { AppBarMenu, type AppBarLink } from './app-bar-menu.tsx'
import { BrandMark } from './brand-mark.tsx'

export type { AppBarLink }

export interface AppBarProps {
  /** Wordmark text. Pass the app's name constant; never hard-code it here. */
  brand: string
  /** Where the wordmark links to. */
  homeHref: string
  /** Primary navigation links. */
  links: AppBarLink[]
  /** Pathname of the current page, used to mark the active link. */
  currentPath?: string
  /** Right-hand actions, e.g. a sign-in link and a primary Keycap. */
  actions?: RemixNode
  /** `sticky` pins a glass bar to the top (app pages); `static` sits on the hero (landing). */
  position?: 'static' | 'sticky'
}

const NARROW = '@media (max-width: 760px)'

/**
 * The top app bar: wordmark, primary nav and actions.
 *
 * The bar itself is server-rendered. On narrow screens the nav collapses into
 * `AppBarMenu`, the only part that hydrates.
 */
export function AppBar(handle: Handle<AppBarProps>) {
  return () => {
    let { brand, homeHref, links, currentPath, actions, position = 'static' } = handle.props

    return (
      <header mix={[barStyle, position === 'sticky' && stickyStyle]}>
        <div mix={innerStyle}>
          <a href={homeHref} mix={brandStyle}>
            <BrandMark />
            <span>{brand}</span>
          </a>
          <nav aria-label="Primary" mix={navStyle}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === currentPath ? 'page' : undefined}
                mix={navLinkStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div mix={actionsStyle}>
            {actions}
            <AppBarMenu links={links} currentPath={currentPath} />
          </div>
        </div>
      </header>
    )
  }
}

const barStyle = css({
  position: 'relative',
  zIndex: 5,
})

const stickyStyle = css({
  position: 'sticky',
  top: 0,
  background: 'var(--scrim)',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  backdropFilter: 'blur(var(--glass-blur))',
  borderBottom: '1px solid var(--line-soft)',
})

const innerStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: '22px var(--page-gutter)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  [NARROW]: { padding: '14px var(--page-gutter)' },
})

const brandStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minHeight: 'var(--touch-target)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-wordmark-size)',
  letterSpacing: 'var(--type-wordmark-tracking)',
  '&:hover': { color: 'var(--text)' },
})

const navStyle = css({
  display: 'flex',
  gap: '28px',
  flexWrap: 'wrap',
  fontSize: 'var(--type-ui-size)',
  [NARROW]: { display: 'none' },
})

const navLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  color: 'var(--text-nav)',
  textDecoration: 'none',
  transition: 'color var(--duration-fast) var(--ease)',
  '&:hover, &[aria-current="page"]': { color: 'var(--text)' },
})

const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'center',
})
