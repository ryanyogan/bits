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
  /**
   * A second row inside the same sticky `<header>`, e.g. the lesson sub-bar
   * (`<LessonBar position="shell">`). Its height must be `--lessonbar-h`;
   * the header marks itself `data-shell="sub"` so `--shell-h` grows to match
   * (decision 022).
   */
  sub?: RemixNode
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
      sub,
      mix,
    } = handle.props
    let marketing = variant === 'marketing'

    return (
      <header
        data-shell={sub ? 'sub' : undefined}
        mix={[barStyle, position === 'sticky' ? stickyStyle : staticStyle, mix]}
      >
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
        {sub}
      </header>
    )
  }
}

const NARROW = '@media (max-width: 759.98px)'

const barStyle = css({
  position: 'relative',
  zIndex: 5,
})

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
  // The menu sheet drops from `--appbar-h`, so the narrow bar matches it.
  [NARROW]: { height: 'calc(var(--appbar-h) - 1px)', padding: '0 var(--page-gutter)', flexWrap: 'nowrap' },
})

// One row at a fixed height (`--appbar-h` with the sticky bar's 1px border,
// decision 022): sticky offsets below the bar (lesson sub-bar, outline,
// scroll-padding) depend on it.
const appInner = css({
  height: 'calc(var(--appbar-h) - 1px)',
  padding: '0 var(--page-gutter)',
  gap: 'var(--space-7)',
  flexWrap: 'nowrap',
  [NARROW]: { gap: 'var(--space-3)' },
})

const navStyle = css({
  display: 'flex',
  fontSize: 'var(--fs-15)',
  whiteSpace: 'nowrap',
  [NARROW]: { display: 'none' },
})

const marketingNav = css({ gap: 'var(--space-7)', flexWrap: 'wrap' })
const appNav = css({ gap: 'var(--space-5_5)' })

const actionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minWidth: 0,
})

const pushRight = css({ marginLeft: 'auto', gap: 'var(--space-3_5)' })
