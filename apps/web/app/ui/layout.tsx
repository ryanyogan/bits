import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { Document, type DocumentImage } from '@bits/ui/document'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Keycap } from '@bits/ui/keycap'
import { StreakPill } from '@bits/ui/streak-pill'
import { XpPill } from '@bits/ui/xp-pill'
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
   * The signed-in viewer, or `null` when signed out: XP, streak and avatar
   * when signed in, "Sign in" + "Start free" otherwise (components §3.1b).
   * Omitting it renders the signed-out actions, so pass it on every page that
   * knows who is viewing.
   */
  viewer?: Viewer | null
  /** Replaces the viewer's XpPill in the bar, e.g. the lesson's reward island. */
  xp?: RemixNode
  /** A second row in the sticky header (`<LessonBar position="shell">`; decision 022). */
  sub?: RemixNode
  /** Full-bleed `<main>`: the page owns its own max-width and padding (bands). */
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
      xp,
      sub,
      bleed,
      bare,
      children,
    } = handle.props

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
                <link key={name} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
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
              <>
                {xp ?? <XpPill neurons={viewer.xp} />}
                <StreakPill days={viewer.streak} />
                <AvatarButton
                  initials={viewer.initials}
                  href={routes.me.index.href()}
                  current={currentPath === routes.me.index.href()}
                />
              </>
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
          <main id="main" tabIndex={-1} mix={[skipTargetStyle, bleed ? undefined : mainStyle]}>
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

const skipTargetStyle = css({ '&:focus': { outline: 'none' } })
const mainStyle = [pageShell, css({ display: 'block' })]
