import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { AppBarMenu, type AppBarLink } from './app-bar-menu.tsx'
import { Crosshair } from './crosshair.tsx'
import { FOCUS, FORCED_COLORS, HOVER } from './lib/states.ts'
import { Logo } from './logo.tsx'
import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
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
  /** id of the mobile menu sheet; give each extra bar on a page its own (styleguide specimens). */
  menuId?: string
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
 * The `app` bar is a band of the squared grid (decision 047): its column
 * is a `PageFrame`'s (same width, same two hairline rails), the nav is a
 * row of full-height cells between hairlines, and `+` marks sit where the
 * bar's full-bleed rule crosses the rails. A page body in a `PageFrame`
 * continues the rails straight down from the bar.
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
      menuId,
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
                data-rmx-prefetch={prefetchFor(link.href)}
                mix={marketing ? [navLinkStyle, navLinkVariants.marketing] : navCellStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div mix={[actionsStyle, marketing ? undefined : pushRight]}>
            {actions}
            <AppBarMenu links={links} currentPath={currentPath} label={navLabel} id={menuId} />
          </div>
          {marketing ? null : (
            <>
              <Crosshair placement="bottom-start" mix={onRuleStyle} />
              <Crosshair placement="bottom-end" mix={onRuleStyle} />
            </>
          )}
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

// Flat (decision 047): an opaque ink ground and a hairline, no blur, so
// the rails and rules scrolling under it never show through (and it
// matches the lesson sub-bar below it).
const stickyStyle = css({
  position: 'sticky',
  top: 0,
  background: 'var(--ink)',
  borderBottom: 'var(--border-w) solid var(--line-section)',
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
  [NARROW]: { height: 'calc(var(--appbar-h) - var(--border-w))', padding: '0 var(--page-gutter)', flexWrap: 'nowrap' },
})

// One row at a fixed height (`--appbar-h` with the sticky bar's 1px border,
// decision 022): sticky offsets below the bar (lesson sub-bar, outline,
// scroll-padding) depend on it.
const appInner = css({
  position: 'relative',
  boxSizing: 'border-box',
  // PageFrame's column: the rails line up with the page's below.
  width: 'min(calc(100% - 2 * var(--frame-inset)), var(--frame-max))',
  maxWidth: 'none',
  height: 'calc(var(--appbar-h) - var(--border-w))',
  alignItems: 'stretch',
  padding: '0 var(--space-3) 0 var(--section-pad-x)',
  gap: 'var(--space-7)',
  flexWrap: 'nowrap',
  borderInline: 'var(--border-w) solid var(--line-rail)',
  '& > a:first-child': { alignSelf: 'center' },
  [NARROW]: { gap: 'var(--space-3)' },
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})

// The bar's rule is the header's bottom border, one pixel under this row.
const onRuleStyle = css({ bottom: 'calc((var(--mark-size) + 1px) / -2)' })

// A nav link that is a full-height cell between hairlines (the landing's
// header, decision 047). Current page: text colour and a 2px volt rule
// along the bottom, drawn inside the cell.
const navCellStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 var(--space-5)',
  boxSizing: 'border-box',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  color: 'var(--muted)',
  fontSize: 'var(--fs-14)',
  textDecoration: 'none',
  transition: 'color var(--duration-fast), background-color var(--duration-fast)',
  '&:last-child': { borderRight: 'var(--border-w) solid var(--line-cell)' },
  [HOVER]: { color: 'var(--text)', background: 'var(--fill-hover)' },
  '&:active': { background: 'var(--fill-btn)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '&[aria-current="page"]': { color: 'var(--text)', boxShadow: 'inset 0 calc(-1 * var(--border-w-strong)) 0 var(--volt)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: {
    borderColor: 'GrayText',
    [HOVER]: { textDecoration: 'underline' },
    '&[aria-current="page"]': { textDecoration: 'underline', textDecorationThickness: 'var(--border-w-strong)' },
  },
})

const navStyle = css({
  display: 'flex',
  fontSize: 'var(--fs-15)',
  whiteSpace: 'nowrap',
  [NARROW]: { display: 'none' },
})

const marketingNav = css({ gap: 'var(--space-7)', flexWrap: 'wrap' })
const appNav = css({ alignItems: 'stretch' })

const actionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minWidth: 0,
})

const pushRight = css({ marginLeft: 'auto', alignSelf: 'center', gap: 'var(--space-3)' })
