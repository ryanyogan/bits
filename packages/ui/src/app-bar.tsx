import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { AppBarMenu, type AppBarLink } from './app-bar-menu.tsx'
import { Crosshair } from './crosshair.tsx'
import { FOCUS, FORCED_COLORS, HOVER } from './lib/states.ts'
import { Logo } from './logo.tsx'
import { prefetchFor } from './lib/prefetch.ts'

export type { AppBarLink }

export interface AppBarProps {
  /** Wordmark text. Pass the app's name constant; never hard-code it here. */
  brand: string
  /** Where the wordmark links to. */
  homeHref: string
  /**
   * Primary navigation, centred in the bar. A link with `section` is an
   * in-page anchor lit while that section is on screen (see `AppBarLink`).
   */
  links: AppBarLink[]
  /** Links for the narrow menu sheet only, after `links` (Sign in, when the bar hides it under 420px). */
  menuExtras?: AppBarLink[]
  /** Pathname of the current page, used to mark the active link (`aria-current="page"`). */
  currentPath?: string
  /**
   * Right-hand group: signed out, a "Sign in" link and a `md` Keycap;
   * signed in, the AvatarButton. Stays visible on mobile.
   */
  actions?: RemixNode
  /** `sticky` pins the bar (every page). `static` scrolls away (styleguide specimens). */
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
 * The header, one on every page (components §3.1; decisions 022, 047, 059).
 *
 * Logo left, the nav truly centred (a 1fr/auto/1fr grid), actions right,
 * exactly `--appbar-h` tall. The row is a band of the squared grid: its
 * column and hairline rails are a `PageFrame`'s, the nav is a row of
 * full-height cells between hairlines, and a full-bleed rule closes the
 * bar with `+` marks where it crosses the rails. Sticky, on an opaque ink
 * ground (flat: no blur, 047), so rules scrolling under it never show.
 *
 * Only the content changes from page to page (links, actions, the lesson
 * sub-bar); the component, style, height and logo never do.
 *
 * Server-rendered. Under 760px the nav collapses into `AppBarMenu`, a menu
 * button that opens a sheet dropping from `--appbar-h` (resolutions §8);
 * that is the only part that ships JS, and it works without JS too
 * (native popover).
 */
export function AppBar(handle: Handle<AppBarProps>) {
  return () => {
    let {
      brand,
      homeHref,
      links,
      menuExtras = [],
      currentPath,
      actions,
      position = 'sticky',
      navLabel = 'Primary',
      menuId,
      sub,
      mix,
    } = handle.props

    return (
      <header data-shell={sub ? 'sub' : undefined} mix={[barStyle, position === 'sticky' ? stickyStyle : undefined, mix]}>
        <div mix={rowStyle}>
          <Logo brand={brand} href={homeHref} variant="nav" mix={logoStyle} />
          <nav aria-label={navLabel} mix={navStyle}>
            {links.map((link) =>
              link.section ? (
                <a key={link.href} href={link.href} mix={[cellStyle, sectionCellStyle]} style={{ '--section': `--${link.section}` }}>
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={link.href === currentPath ? 'page' : undefined}
                  data-rmx-prefetch={prefetchFor(link.href)}
                  mix={cellStyle}
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>
          <div mix={actionsStyle}>
            {actions}
            <AppBarMenu links={[...links, ...menuExtras]} currentPath={currentPath} label={navLabel} id={menuId} />
          </div>
          <Crosshair placement="bottom-start" mix={onRuleStyle} />
          <Crosshair placement="bottom-end" mix={onRuleStyle} />
        </div>
        {sub}
      </header>
    )
  }
}

const NARROW = '@media (max-width: 759.98px)'
const MID = '@media (max-width: 1023.98px)'

// The bar's ground and rule are the header's own, so they run the full
// width of the screen, past the rails. The same in either position, so a
// static specimen is exactly as tall as the sticky bar.
const barStyle = css({
  position: 'relative',
  zIndex: 5,
  background: 'var(--ink)',
  borderBottom: 'var(--border-w) solid var(--line-section)',
  [FORCED_COLORS]: { background: 'Canvas', borderColor: 'GrayText' },
})

const stickyStyle = css({ position: 'sticky', top: 0 })

// One row at a fixed height (`--appbar-h` with the header's 1px rule,
// decision 022): sticky offsets below the bar (lesson sub-bar, outline,
// scroll-padding, the menu sheet) depend on it. Nothing wraps.
const rowStyle = css({
  position: 'relative',
  boxSizing: 'border-box',
  // PageFrame's column: the rails line up with the page's below.
  width: 'min(calc(100% - 2 * var(--frame-inset)), var(--frame-max))',
  height: 'calc(var(--appbar-h) - var(--border-w))',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'stretch',
  gap: 'var(--space-5)',
  borderInline: 'var(--border-w) solid var(--line-rail)',
  whiteSpace: 'nowrap',
  // 760–1023px: tighter cells, and the nav takes the middle track so logo,
  // nav and actions fit without overlap. (Custom properties: a descendant
  // rule here would lose to the cell's own mixin.)
  [MID]: {
    gridTemplateColumns: 'auto 1fr auto',
    gap: 'var(--space-3)',
    '--appbar-link-pad': 'var(--space-3)',
    '--appbar-link-fs': 'var(--fs-13)',
  },
  [NARROW]: { gridTemplateColumns: '1fr auto' },
  [FORCED_COLORS]: { borderColor: 'GrayText' },
})

const logoStyle = css({ justifySelf: 'start', alignSelf: 'center', marginLeft: 'var(--section-pad-x)' })

// The bar's rule is the header's bottom border, one pixel under this row.
const onRuleStyle = css({ bottom: 'calc((var(--mark-size) + 1px) / -2)' })

// The nav is a row of cells: each link fills the bar's height between
// hairlines, so the header reads as part of the grid.
const navStyle = css({
  justifySelf: 'center',
  display: 'flex',
  alignItems: 'stretch',
  [NARROW]: { display: 'none' },
})

// A nav link that is a full-height cell between hairlines. Current page:
// text colour and a 2px volt rule along the bottom, drawn inside the cell.
const cellStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--appbar-link-pad, var(--space-5))',
  boxSizing: 'border-box',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
  color: 'var(--text-lead)',
  fontSize: 'var(--appbar-link-fs, var(--fs-14))',
  textDecoration: 'none',
  transition: 'color var(--duration-fast), background-color var(--duration-fast), box-shadow var(--duration-fast)',
  '&:last-child': { borderRight: 'var(--border-w) solid var(--line-cell)' },
  [HOVER]: { color: 'var(--text)', background: 'var(--fill-hover)' },
  '&:active': { background: 'var(--fill-btn)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '&[aria-current="page"]': { color: 'var(--text)', boxShadow: 'inset 0 calc(-1 * var(--border-w-strong)) 0 var(--volt)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  // Fills and the inset rule vanish in forced colours: underline instead.
  [FORCED_COLORS]: {
    borderColor: 'GrayText',
    [HOVER]: { textDecoration: 'underline' },
    '&[aria-current="page"]': { textDecoration: 'underline', textDecorationThickness: 'var(--border-w-strong)' },
  },
})

// An in-page section link (`section: 'how'` → `--how`), lit like the
// current page while its section is on screen. The link's `--section`
// names a view timeline the page declares on that section and scopes on
// an ancestor of both (`timeline-scope`, e.g. on `body`). No JS; without
// view timelines the link is just a link.
const sectionCellStyle = css({
  '@supports (animation-timeline: view())': {
    // No fill: outside the range the link is its normal self.
    animation: 'bits-nav-here linear',
    animationTimeline: 'var(--section)',
    animationRange: 'cover 25% cover 75%',
  },
  '@keyframes bits-nav-here': {
    'from, to': { color: 'var(--text)', boxShadow: 'inset 0 calc(-1 * var(--border-w-strong)) 0 var(--volt)' },
  },
})

const actionsStyle = css({
  justifySelf: 'end',
  alignSelf: 'center',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
  marginRight: 'var(--space-3)',
})
