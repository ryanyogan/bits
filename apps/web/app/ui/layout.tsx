import type { Handle, RemixNode } from 'remix/component'
import { css, Fragment } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { Document, type DocumentImage } from '@bits/ui/document'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { prefetchFor } from '@bits/ui/lib/prefetch'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE, pageTitle } from '../config.ts'
import type { Viewer } from '../auth/identity.ts'
import type { RewardNotice } from '../progress/reward.ts'
import { routes } from '../routes.ts'
import { HOME_ALT, ogImage } from './og.ts'
import { BadgeNotice } from './badge-notice.tsx'
import { pageShell } from './page-shell.ts'

export interface LayoutProps {
  /** Page name; the document title becomes "<title> · Bits". Omit on the landing page. */
  title?: string
  description?: string
  /** Pathname of this page, to mark the active nav link. */
  currentPath?: string
  /** This page's own path, for the canonical URL and link previews (shareable pages only). */
  canonicalPath?: string
  /** `sticky` for app pages, `static` over the landing hero. */
  bar?: 'static' | 'sticky'
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
   * in (no XP or streak pill: one uniform header, decision 048), "Sign in" + "Start free" otherwise (components §3.1b).
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

const appLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: routes.me.index.href(), label: 'My learning' },
  { href: routes.author.index.href(), label: 'Write a course' },
]

/**
 * The public URL for a path, from CANONICAL_ORIGIN (production). Undefined
 * without it, so development pages don't claim a canonical address.
 */
export function canonicalUrl(path: string): string | undefined {
  let origin = platform.env.CANONICAL_ORIGIN
  return origin && platform.env.APP_ENV === 'production' ? new URL(path, origin).href : undefined
}

/**
 * The app's page shell (decision 022): the design-system Document wired to
 * this runtime's assets, the skip link and the sticky AppBar, the same on
 * every app page. Lesson pages add their sub-bar with `sub`. The landing and
 * sign-in pages draw their own frames.
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
      description = APP_TAGLINE,
      currentPath,
      canonicalPath,
      bar = 'sticky',
      head,
      image = ogImage('home', HOME_ALT),
      reward,
      preloadFonts = [],
      viewer,
      sub,
      bleed,
      bare,
      children,
    } = handle.props
    let framed = !bare && hasPageFrame(children)

    return (
      <Document
        assets={platform.assets}
        url={canonicalPath ? canonicalUrl(canonicalPath) : undefined}
        siteName={APP_NAME}
        image={image}
        title={pageTitle(title)}
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
          links={appLinks}
          currentPath={currentPath}
          position={bar}
          sub={sub}
          actions={
            viewer ? (
              <AvatarButton
                initials={viewer.initials}
                href={routes.me.index.href()}
                current={currentPath === routes.me.index.href()}
              />
            ) : (
              <>
                <a href={routes.login.index.href()} data-rmx-prefetch={prefetchFor(routes.login.index.href())} mix={signInStyle}>
                  Sign in
                </a>
                <Keycap href={routes.courses.index.href()}>Start free</Keycap>
              </>
            )
          }
        />
        {bare ? (
          children
        ) : (
          // tabIndex -1: the skip link moves focus (and a screen reader's cursor) into it (decision 031).
          <main id="main" tabIndex={-1} mix={[skipTargetStyle, framed ? framedMainStyle : bleed ? undefined : mainStyle]}>
            {children}
          </main>
        )}
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

const signInStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-2)',
  color: 'var(--text-lead)',
  textDecoration: 'none',
  fontSize: 'var(--type-ui-size)',
  '&:hover': { color: 'var(--text)' },
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
  minHeight: 'calc(100dvh - var(--shell-h))',
  '& > :last-child': { flexGrow: 1 },
})
