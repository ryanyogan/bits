import { css, type Handle, type RemixNode } from 'remix/component'
import { AppBarMenu, type AppBarLink } from '@bits/ui/app-bar-menu'
import { Crosshair } from '@bits/ui/crosshair'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { Logo } from '@bits/ui/logo'

import { FORCED, REDUCED } from './styles.ts'

export interface LandingLink extends AppBarLink {
  /** A section on this page (`#how`): highlighted while that section is in view. */
  section?: string
}

export interface LandingHeaderProps {
  brand: string
  homeHref: string
  links: LandingLink[]
  /** Extra links for the narrow menu sheet only (Sign in, when it's hidden from the bar). */
  menuExtras?: AppBarLink[]
  actions: RemixNode
}

/**
 * The landing page's header (Main.md §1; decisions 022, 040, 047).
 *
 * It lives inside the page's `PageFrame`, so the rails run through it. The
 * nav is a row of cells, each a full-height 44px+ link between hairlines,
 * truly centred between the logo and the actions (a 1fr/auto/1fr grid).
 * A full-bleed rule closes the bar, with `+` marks on the rails.
 *
 * - Transparent over the hero. Where scroll-driven animations exist it
 *   sticks and fills with ink over the first 120px of scroll (no JS; it
 *   follows the reader's own scroll). Flat: no blur (047).
 * - The section links light up while their section is on screen (view
 *   timelines on #how and #path, scoped on the page root): text colour
 *   and a volt underline.
 * - Under 760px the nav folds into `AppBarMenu`'s sheet, which drops from
 *   `--appbar-h`, so the bar is exactly that tall.
 */
export function LandingHeader(handle: Handle<LandingHeaderProps>) {
  return () => {
    let { brand, homeHref, links, menuExtras = [], actions } = handle.props
    return (
      <header mix={headerStyle}>
        <div mix={innerStyle}>
          <Logo brand={brand} href={homeHref} variant="nav" mix={logoStyle} />
          <nav aria-label="Primary" mix={navStyle}>
            {links.map((link) =>
              link.section ? (
                <a
                  key={link.href}
                  href={link.href}
                  mix={[navLinkStyle, sectionLinkStyle]}
                  style={{ '--section': `--${link.section}` }}
                >
                  {link.label}
                </a>
              ) : (
                <a key={link.href} href={link.href} data-rmx-prefetch={prefetchFor(link.href)} mix={navLinkStyle}>
                  {link.label}
                </a>
              ),
            )}
          </nav>
          <div mix={actionsStyle}>
            {actions}
            <AppBarMenu links={[...links, ...menuExtras]} label="Primary" id="landing-nav-sheet" />
          </div>
        </div>
        <Crosshair placement="bottom-start" />
        <Crosshair placement="bottom-end" />
      </header>
    )
  }
}

/** A nav cell's link, shared with the header's Sign in link. */
export const navLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  // The nav narrows this on mid-size screens (a custom property: a
  // descendant rule on the nav's mixin would lose to this mixin's layer).
  padding: '0 var(--landing-link-pad, var(--space-5))',
  boxSizing: 'border-box',
  color: 'var(--text-lead)',
  fontSize: 'var(--landing-link-fs, var(--fs-14))',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  transition: 'color var(--duration-fast), background-color var(--duration-fast), box-shadow var(--duration-fast)',
  '&:hover': { color: 'var(--text)', background: 'var(--fill-hover)' },
  '&:active': { background: 'var(--fill-btn)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  [REDUCED]: { transition: 'none' },
  // Hover fills vanish in forced colours; underline instead.
  [FORCED]: { '&:hover': { textDecoration: 'underline' } },
})

// Lit while its section is in view: the link's `--section` names the view
// timeline (`--how`, `--path`), declared on the section and scoped on the
// page root (home-page.tsx). The keyframes live in the page's CSS.
const sectionLinkStyle = css({
  '@supports (animation-timeline: view())': {
    // No fill: outside the range the link is its normal self.
    animation: 'landing-here linear',
    animationTimeline: 'var(--section)',
    animationRange: 'cover 25% cover 75%',
  },
})

const headerStyle = css({
  position: 'relative',
  zIndex: 5,
  // Its own rails (decision 050): the frame draws none, so the bar and the
  // hero plate under it share one pair of lines.
  borderInline: 'var(--border-w) solid var(--line-rail)',
  // The bar's ground and rule run the full width of the screen, past the rails.
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: '0 auto 0 50%',
    width: '100vw',
    transform: 'translateX(-50%)',
    borderBottom: 'var(--border-w) solid var(--line-section)',
    background: 'var(--landing-bar-bg, transparent)',
    zIndex: -1,
    pointerEvents: 'none',
  },
  '@supports (animation-timeline: scroll())': {
    position: 'sticky',
    top: 0,
    animation: 'landing-bar linear both',
    animationTimeline: 'scroll(root)',
    animationRange: '0 var(--space-30)',
  },
  [FORCED]: { background: 'Canvas', borderColor: 'GrayText' },
})

const innerStyle = css({
  height: 'var(--appbar-h)',
  paddingBottom: 'var(--border-w)',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'stretch',
  gap: 'var(--space-5)',
  // 760–1023px: tighter links so logo, nav and actions fit without overlap.
  '@media (max-width: 1023.98px)': {
    gridTemplateColumns: 'auto 1fr auto',
    gap: 'var(--space-3)',
    '--landing-link-pad': 'var(--space-3)',
    '--landing-link-fs': 'var(--fs-13)',
  },
  '@media (max-width: 759.98px)': { gridTemplateColumns: '1fr auto' },
})

const logoStyle = css({ justifySelf: 'start', alignSelf: 'center', marginLeft: 'var(--section-pad-x)' })

// The nav is a row of cells: each link fills the bar's height between
// hairlines, so the header reads as part of the grid.
const navStyle = css({
  justifySelf: 'center',
  display: 'flex',
  alignItems: 'stretch',
  '& > a': { borderLeft: 'var(--border-w) solid var(--line-cell)' },
  '& > a:last-child': { borderRight: 'var(--border-w) solid var(--line-cell)' },
  '@media (max-width: 759.98px)': { display: 'none' },
  [FORCED]: { '& > a': { borderColor: 'GrayText' } },
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
