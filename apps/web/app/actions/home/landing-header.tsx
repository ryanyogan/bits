import { css, type Handle, type RemixNode } from 'remix/component'
import { AppBarMenu, type AppBarLink } from '@bits/ui/app-bar-menu'
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
 * The landing page's header (Main.md §1; decision 022 keeps the landing's
 * bar apart from the app shell, decision 040 restyles it).
 *
 * - Logo left, actions right, and the primary nav truly centred between
 *   them (a 1fr/auto/1fr grid, not space-between) in a glass capsule, with
 *   44px pill links that fill on hover.
 * - Transparent over the hero. Where scroll-driven animations exist it
 *   sticks, and frosts over the first 120px of scroll (no JS; it follows the
 *   reader's own scroll, so it isn't autonomous motion). Elsewhere it stays
 *   static and scrolls away, as before.
 * - The section links light up while their section is on screen (view
 *   timelines on #how and #path, scoped on the page root).
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
      </header>
    )
  }
}

/** The pill link style, shared with the header's Sign in link. */
export const navLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  // The nav narrows this on mid-size screens (a custom property: a
  // descendant rule on the nav's mixin would lose to this mixin's layer).
  padding: '0 var(--landing-link-pad, var(--space-4))',
  boxSizing: 'border-box',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--text-lead)',
  fontSize: 'var(--landing-link-fs, var(--fs-15))',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  transition: 'color var(--duration-fast), background-color var(--duration-fast)',
  '&:hover': { color: 'var(--text)', background: 'var(--fill-ghost-hover)' },
  '&:active': { background: 'var(--fill-btn)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
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
  borderBottom: 'var(--border-w) solid transparent',
  '@supports (animation-timeline: scroll())': {
    position: 'sticky',
    top: 0,
    animation: 'landing-bar linear both',
    animationTimeline: 'scroll(root)',
    animationRange: '0 var(--space-30)',
  },
  [FORCED]: { background: 'Canvas' },
})

const innerStyle = css({
  maxWidth: 'var(--page-max)',
  height: 'calc(var(--appbar-h) - 1px)',
  margin: '0 auto',
  padding: '0 var(--page-gutter)',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 'var(--space-5)',
  // 760–1023px: tighter links so logo, nav and actions fit without overlap
  // (the 1fr columns would otherwise squeeze the actions under the nav).
  '@media (max-width: 1023.98px)': {
    gridTemplateColumns: 'auto 1fr auto',
    gap: 'var(--space-3)',
    '--landing-link-pad': 'var(--space-2_5)',
    '--landing-link-fs': 'var(--fs-14)',
  },
  '@media (max-width: 759.98px)': { gridTemplateColumns: '1fr auto' },
})

const logoStyle = css({ justifySelf: 'start' })

const navStyle = css({
  justifySelf: 'center',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-0_5)',
  padding: 'var(--space-1)',
  borderRadius: 'var(--radius-pill)',
  border: 'var(--border-w) solid var(--line-glass)',
  background: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
  backdropFilter: 'blur(var(--blur-glass))',
  boxShadow: 'inset 0 1px 0 var(--fill-hover)',
  '@media (max-width: 759.98px)': { display: 'none' },
  [FORCED]: { border: '1px solid CanvasText' },
})

const actionsStyle = css({
  justifySelf: 'end',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minWidth: 0,
})
