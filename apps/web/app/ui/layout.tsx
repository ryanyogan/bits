import type { Handle, RemixNode } from 'remix/component'
import { css, Fragment } from 'remix/component'
import { AccountMenu, type AccountMenuLink } from '@bits/ui/account-menu'
import { AppBar, type AppBarLink } from '@bits/ui/app-bar'
import { Document, type DocumentImage } from '@bits/ui/document'
import { Footer, type FooterProps } from '@bits/ui/footer'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { prefetchFor } from '@bits/ui/lib/prefetch'
import { RuledSection } from '@bits/ui/ruled-section'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE, pageTitle } from '../config.ts'
import { canAuthor, type Viewer } from '../auth/identity.ts'
import { lessonOneHref } from '../actions/home/links.ts'
import type { RewardNotice } from '../progress/reward.ts'
import { routes } from '../routes.ts'
import { HOME_ALT, ogImage } from './og.ts'
import { BadgeNotice } from './badge-notice.tsx'
import { learnerHasProgress } from './learner-scope.tsx'
import { pageShell } from './page-shell.ts'

export interface LayoutProps {
  /** Page name; the document title becomes "<title> · bits". Omit on the landing page. */
  title?: string
  /** The whole document title, as is, instead of "<title> · bits" (the landing page). */
  documentTitle?: string
  description?: string
  /** Pathname of this page, to mark the active nav link. */
  currentPath?: string
  /** This page's own path, for the canonical URL and link previews (shareable pages only). */
  canonicalPath?: string
  /**
   * The header's centred nav (decision 059): the viewer's app links
   * (`appLinksFor`) by default; the landing passes its own (with in-page
   * `section` links).
   */
  links?: AppBarLink[]
  /**
   * The header's account actions. Off on the sign-in pages, which are
   * themselves the way in (decision 059).
   */
  account?: boolean
  /**
   * Where the signed-out "Start free" key goes (lesson 1 by default). The
   * key is left out on the page it points at.
   */
  startHref?: string
  /**
   * `false` on lesson pages: the learner is already in a lesson, so the
   * signed-out bar offers no "Start free" (decision 070). With progress the
   * bar still shows Continue.
   */
  start?: boolean
  /**
   * Where the "Continue" key goes (signed in, or signed out with progress
   * in the session; decision 070): `GET /continue` by default,
   * which finds the next lesson (decision 065). A page that already knows
   * the next lesson (the landing) passes it.
   */
  continueHref?: string
  /**
   * The site footer (decision 065): Courses, Terms, Privacy and the
   * viewer's links, under every page. On by default, except on `bare` pages
   * (the lesson workspace; the landing draws its own, with the theme switch).
   */
  footer?: boolean
  head?: RemixNode
  /** The link-preview card (`ogImage()` from ui/og.ts); the landing card when omitted. */
  image?: DocumentImage
  /** A badge the server just awarded (`takeReward()`): shown once as a toast (decision 028). */
  reward?: RewardNotice
  /**
   * Extra self-hosted faces this page shows above the fold, by file name
   * (`unbounded-latin-500-normal.woff2`). Preloaded after the two every page
   * gets (Geist 400, Unbounded 700; decision 023).
   */
  preloadFonts?: string[]
  /**
   * The signed-in viewer, or `null` when signed out: the avatar when signed
   * in (no XP or streak pill: one uniform header, decision 048), "Sign in" + one primary key otherwise
   * ("Start free", or "Continue" once the session has progress; decision 070).
   * Omitting it renders the signed-out actions, so pass it on every page that
   * knows who is viewing.
   */
  viewer?: Viewer | null
  /** A second row in the sticky header (`<LessonBar position="shell">`; decision 022). */
  sub?: RemixNode
  /**
   * Full-bleed `<main>`: the page owns its own max-width and padding. Not
   * needed for a page that wraps its body in `<PageFrame>`: Layout sees the
   * frame and steps aside on its own (see `Layout`).
   */
  bleed?: boolean
  /** No `<main>` wrapper: the page renders its own `<main id="main">` (lesson pages). */
  bare?: boolean
  children?: RemixNode
}

/** "Write a course" for the people who can (authors and admins; decision 065). */
export function authorLinkFor(viewer: Viewer | null | undefined): AppBarLink[] {
  return viewer && canAuthor(viewer) ? [{ href: routes.author.index.href(), label: 'Write a course' }] : []
}

/**
 * The app's nav, the header on every page but the landing (decisions 059,
 * 065): Courses for everyone, My learning once signed in (signed out it is
 * only a sign-in wall), Write a course for authors.
 */
export function appLinksFor(viewer: Viewer | null | undefined): AppBarLink[] {
  return [
    { href: routes.courses.index.href(), label: 'Courses' },
    ...(viewer ? [{ href: routes.me.index.href(), label: 'My learning' }] : []),
    ...authorLinkFor(viewer),
  ]
}

/** The footer's links (decision 065): what this viewer can open, then the policies. */
export function footerLinksFor(viewer: Viewer | null | undefined): FooterProps['links'] {
  return [
    { href: routes.courses.index.href(), label: 'Courses' },
    ...(viewer
      ? [
          { href: routes.me.index.href(), label: 'My learning' },
          { href: routes.settings.index.href(), label: 'Settings' },
        ]
      : [{ href: routes.login.index.href(), label: 'Sign in' }]),
    ...authorLinkFor(viewer),
    { href: routes.legal.terms.href(), label: 'Terms' },
    { href: routes.legal.privacy.href(), label: 'Privacy' },
  ]
}

/** "© 2026 bits" (lowercase, decision 005). */
export const copyright = `© 2026 ${APP_NAME}`

/** The account menu's links (decision 065): the viewer's own pages. */
function accountLinksFor(viewer: Viewer): AccountMenuLink[] {
  return [
    { href: routes.me.index.href(), label: 'My learning' },
    ...(viewer.isPublic ? [{ href: routes.profile.index.href({ handle: viewer.handle }), label: 'Public profile' }] : []),
    { href: routes.settings.index.href(), label: 'Settings' },
    ...(viewer.role === 'admin' ? [{ href: routes.admin.authors.index.href(), label: 'Admin: authors' }] : []),
  ]
}

/**
 * The public URL for a path, from CANONICAL_ORIGIN (production). Undefined
 * without it, so development pages don't claim a canonical address.
 */
export function canonicalUrl(path: string): string | undefined {
  let origin = platform.env.CANONICAL_ORIGIN
  return origin && platform.env.APP_ENV === 'production' ? new URL(path, origin).href : undefined
}

/**
 * The page shell (decisions 022, 059): the design-system Document wired to
 * this runtime's assets, the skip link and the sticky AppBar, the same on
 * every page, the landing and sign-in included. Pages change only what the
 * header holds: the landing passes its own `links`, the sign-in pages drop
 * the account actions (`account={false}`), and lesson pages add their
 * sub-bar with `sub`.
 *
 * The squared grid (decision 047): the page brings the frame. Wrap the
 * page body in `<PageFrame>` (as `<main>`'s top-level child) and lay it out
 * in `RuledSection`s. Layout notices the frame and gives `<main>` no width
 * or padding of its own, and stretches the frame to the bottom of the
 * screen, so its rails run unbroken from the AppBar's (which sit on the
 * same column) to the foot of the page. `bleed` is then implied. A page
 * without a frame keeps the old padded `pageShell` column.
 */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let {
      title,
      documentTitle,
      description = APP_TAGLINE,
      currentPath,
      canonicalPath,
      links,
      account = true,
      startHref = lessonOneHref(),
      start = true,
      continueHref = routes.continue.href(),
      head,
      image = ogImage('home', HOME_ALT),
      reward,
      preloadFonts = [],
      viewer,
      sub,
      bleed,
      bare,
      footer = !bare,
      children,
    } = handle.props
    let framed = !bare && hasPageFrame(children)
    let loginHref = routes.login.index.href()
    let navLinks = links ?? appLinksFor(viewer)
    // One primary key in the bar (decision 070): Continue once there is
    // progress (signed in, or a signed-out session with lessons done), else
    // Start free, never on a lesson page or on the page it points at.
    let primary: 'continue' | 'start' | null = viewer || learnerHasProgress(handle)
      ? 'continue'
      : start && currentPath !== startHref
        ? 'start'
        : null

    return (
      <Document
        assets={platform.assets}
        url={canonicalPath ? canonicalUrl(canonicalPath) : undefined}
        siteName={APP_NAME}
        image={image}
        title={documentTitle ?? pageTitle(title)}
        description={description}
        head={
          <>
            {preloadFonts.map((name) => {
              let href = platform.assets.fonts[name]
              return href ? (
                <link key={name} data-rmx-key={`preload:${href}`} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
              ) : null
            })}
            {head}
          </>
        }
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        <AppBar
          brand={APP_NAME}
          homeHref={routes.home.href()}
          links={navLinks}
          currentPath={currentPath}
          sub={sub}
          // Under 420px the bar keeps its one key and the menu; Sign in moves
          // into the menu sheet, so it is never out of reach. Signed in, the
          // sheet adds the account's pages (Sign out stays in the avatar menu:
          // it is a POST form).
          menuExtras={
            !account
              ? undefined
              : viewer
                ? [
                    // Under 420px the bar drops Continue (it would crowd the logo); the sheet keeps it.
                    { href: continueHref, label: 'Continue', prefetch: false },
                    ...accountLinksFor(viewer).filter((link) => !navLinks.some((nav) => nav.href === link.href)),
                  ]
                : [{ href: loginHref, label: 'Sign in' }]
          }
          actions={
            !account ? null : viewer ? (
              <>
                {/* Never prefetched: /continue reads progress and redirects. */}
                <Keycap href={continueHref} prefetch={false} mix={barKeyStyle}>
                  Continue
                </Keycap>
                <AccountMenu
                  initials={viewer.initials}
                  name={viewer.name || viewer.handle}
                  handle={`@${viewer.handle}`}
                  links={accountLinksFor(viewer)}
                  signOutAction={routes.logout.action.href()}
                  currentPath={currentPath}
                />
              </>
            ) : (
              <>
                <a href={loginHref} data-rmx-prefetch={prefetchFor(loginHref)} mix={signInStyle}>
                  Sign in
                </a>
                {primary === 'continue' ? (
                  <Keycap href={continueHref} prefetch={false} mix={signedOutKeyStyle}>
                    Continue
                  </Keycap>
                ) : primary === 'start' ? (
                  <Keycap href={startHref} mix={signedOutKeyStyle}>
                    Start free
                  </Keycap>
                ) : null}
              </>
            )
          }
        />
        <div mix={footer ? stackStyle : undefined}>
          {bare ? (
            children
          ) : (
            // tabIndex -1: the skip link moves focus (and a screen reader's cursor) into it (decision 031).
            <main id="main" tabIndex={-1} mix={[skipTargetStyle, framed ? [framedMainStyle, footer ? undefined : fullHeightStyle] : bleed ? undefined : mainStyle]}>
              {children}
            </main>
          )}
          {footer ? (
            <PageFrame mix={footerFrameStyle}>
              {/* The frame's last plate; a framed page's own bottom gap is the gap above it. */}
              <RuledSection as="div" pad="none" mix={framed ? joinedFooterStyle : undefined}>
                <Footer brand={APP_NAME} homeHref={routes.home.href()} links={footerLinksFor(viewer)} copyright={copyright} mix={footerStyle} />
              </RuledSection>
            </PageFrame>
          ) : null}
        </div>
        {reward ? <BadgeNotice reward={reward} /> : null}
      </Document>
    )
  }
}

const skipLinkStyle = css({
  position: 'absolute',
  left: 'var(--space-4)',
  top: '-100px',
  zIndex: 10,
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  '&:focus': { top: 'var(--space-4)' },
})

// The bar's key: the same size as signed out's Start free. Under 420px it
// moves into the menu sheet (menuExtras), like Sign in.
const barKeyStyle = css({ flex: 'none', '@media (max-width: 420px)': { display: 'none' } })

// Signed out, the one key stays in the bar at every width; under 360px it
// tightens so the wordmark keeps its room at 320 (decision 070).
const signedOutKeyStyle = css({ flex: 'none', '@media (max-width: 359.98px)': { padding: '0 var(--space-3)' } })

const signInStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  color: 'var(--text-lead)',
  textDecoration: 'none',
  fontSize: 'var(--fs-14)',
  transition: 'color var(--duration-fast)',
  '&:hover': { color: 'var(--text)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@media (forced-colors: active)': { '&:hover': { textDecoration: 'underline' } },
  // In the menu sheet instead (menuExtras).
  '@media (max-width: 420px)': { display: 'none' },
})

/**
 * Whether the page's body is (or starts with) a `PageFrame`: a top-level
 * child, or one inside a top-level fragment. Element types are compared by
 * identity, so this is a plain server-side check with no markup contract.
 */
function hasPageFrame(node: RemixNode): boolean {
  if (Array.isArray(node)) return node.some(hasPageFrame)
  if (!node || typeof node !== 'object' || !('type' in node)) return false
  let element = node as { type: unknown; props?: { children?: RemixNode } }
  if (element.type === PageFrame) return true
  return element.type === Fragment ? hasPageFrame(element.props?.children) : false
}

// Every Layout <main> clips sideways overflow. A RuledSection's rule is
// 100vw wide, and beside a classic scrollbar 100vw is wider than the page,
// so without this every ruled page scrolled ~7px sideways. `clip` (not
// `hidden`) makes no scroll container, so sticky children still stick.
const skipTargetStyle = css({ overflowX: 'clip', '&:focus': { outline: 'none' } })
const mainStyle = [pageShell, css({ display: 'block' })]
// The frame grows to fill the screen under the bar, so its rails reach the
// bottom even on a short page.
const framedMainStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& > :last-child': { flexGrow: 1 },
})
// Without a footer the page alone fills the screen (with one, `stackStyle` does).
const fullHeightStyle = css({ minHeight: 'calc(100dvh - var(--shell-h))' })

// With a footer, the page and the footer share the screen under the bar:
// a short page's frame grows, so the footer sits at the foot of the screen
// (decision 065), and a long page just flows into it.
const stackStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100dvh - var(--shell-h))',
  '& > main': { flexGrow: 1 },
})

const footerFrameStyle = css({ paddingBottom: 0 })
const joinedFooterStyle = css({ marginTop: 0 })
// The plate draws the rule and rails; the footer is its flat fill.
const footerStyle = css({ borderTop: 0, background: 'var(--cell-fill)' })
