import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { AppBarMenu, type AppBarLink } from './app-bar-menu.tsx'
import { Logo } from './logo.tsx'
import { navLinkStyle, navLinkVariants } from './nav-link.tsx'

export type { AppBarLink }

export interface AppBarProps {
  /** Wordmark text. Pass the app's name constant; never hard-code it here. */
  brand: string
  /** Where the wordmark links to. */
  homeHref: string
  /** Primary navigation links. */
  links: AppBarLink[]
  /** Pathname of the current page, used to mark the active link (`aria-current="page"`). */
  currentPath?: string
  /**
   * Right-hand group: signed out, a "Sign in" NavLink and a `md` Keycap;
   * signed in, XpPill + StreakPill + AvatarButton. Stays visible on mobile.
   */
  actions?: RemixNode
  /**
   * `app` (Catalog, Course, Profile, Authoring): 26px mark, nav beside the
   * logo, actions pushed right. `marketing` (landing): 30px mark, centred nav.
   */
  variant?: 'app' | 'marketing'
  /**
   * `sticky` pins the glass bar (resolutions §5, every app page). `static`
   * is transparent and scrolls away (landing hero over the 3D field).
   */
  position?: 'static' | 'sticky'
  /** Accessible name of the primary nav. */
  navLabel?: string
  mix?: MixInput<HTMLElement>
}

/**
 * The top app bar (components §3.1): logo, primary nav and actions.
 *
 * Server-rendered. Under 760px the nav collapses into `AppBarMenu`, a menu
 * button that opens a sheet (resolutions §8); that is the only part that
 * ships JS, and it works without JS too (native popover).
 */
export function AppBar(handle: Handle<AppBarProps>) {
  return () => {
    let {
      brand,
      homeHref,
      links,
      currentPath,
      actions,
      variant = 'app',
      position = 'sticky',
      navLabel = 'Primary',
      mix,
    } = handle.props
    let marketing = variant === 'marketing'

    return (
      <header mix={[barStyle, position === 'sticky' ? stickyStyle : staticStyle, marketing ? marketingBar : appBar, mix]}>
        <div mix={[innerStyle, marketing ? marketingInner : appInner]}>
          <Logo brand={brand} href={homeHref} variant={marketing ? 'nav' : 'app'} />
          <nav aria-label={navLabel} mix={[navStyle, marketing ? marketingNav : appNav]}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === currentPath ? 'page' : undefined}
                mix={[navLinkStyle, navLinkVariants[marketing ? 'marketing' : 'app']]}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div mix={[actionsStyle, marketing ? undefined : pushRight]}>
            {actions}
            <AppBarMenu links={links} currentPath={currentPath} label={navLabel} />
          </div>
        </div>
      </header>
    )
  }
}

const NARROW = '@media (max-width: 759.98px)'

const barStyle = css({
  position: 'relative',
  zIndex: 5,
})

const marketingBar = css({ '--appbar-h': '88px' })
const appBar = css({ '--appbar-h': '73px' })

const stickyStyle = css({
  position: 'sticky',
  top: 0,
  background: 'var(--appbar-bg)',
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
  borderBottom: '1px solid var(--line-bar)',
})

const staticStyle = css({ background: 'transparent' })

const innerStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
})

const marketingInner = css({
  padding: 'var(--space-5_5) var(--page-gutter)',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  [NARROW]: { padding: 'var(--space-3_5) var(--page-gutter)', flexWrap: 'nowrap' },
})

const appInner = css({
  padding: 'var(--space-3_5) var(--page-gutter)',
  gap: 'var(--space-7)',
  [NARROW]: { gap: 'var(--space-3)', flexWrap: 'nowrap' },
})

const navStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: 'var(--fs-15)',
  [NARROW]: { display: 'none' },
})

const marketingNav = css({ gap: 'var(--space-7)' })
const appNav = css({ gap: 'var(--space-5_5)' })

const actionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minWidth: 0,
})

const pushRight = css({ marginLeft: 'auto', gap: 'var(--space-3_5)' })
