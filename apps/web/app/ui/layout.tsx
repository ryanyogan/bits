import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { Document } from '@bits/ui/document'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Keycap } from '@bits/ui/keycap'
import { StreakPill } from '@bits/ui/streak-pill'
import { XpPill } from '@bits/ui/xp-pill'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE, pageTitle } from '../config.ts'
import type { Viewer } from '../data/fixtures.ts'
import { routes } from '../routes.ts'

export interface LayoutProps {
  /** Page name; the document title becomes "<title> · Bits". Omit on the landing page. */
  title?: string
  description?: string
  /** Pathname of this page, to mark the active nav link. */
  currentPath?: string
  /** `sticky` for app pages, `static` over the landing hero. */
  bar?: 'static' | 'sticky'
  head?: RemixNode
  /**
   * App pages pass the signed-in viewer (or `null` when signed out) to get the
   * `app` bar: Courses / My learning / Write a course, plus XP, streak and
   * avatar when signed in (components §3.1b). Omit for the marketing links.
   */
  viewer?: Viewer | null
  /** Full-bleed `<main>`: the page owns its own max-width and padding (bands). */
  bleed?: boolean
  children?: RemixNode
}

const appLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: routes.me.index.href(), label: 'My learning' },
  { href: routes.author.index.href(), label: 'Write a course' },
]

const navLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: `${routes.home.href()}#how`, label: 'How it works' },
  { href: routes.author.index.href(), label: 'For authors' },
]

/**
 * The app's page shell: the design-system Document wired to this runtime's
 * assets, plus the AppBar. Every page renders through it.
 */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, description = APP_TAGLINE, currentPath, bar = 'sticky', head, viewer, bleed, children } =
      handle.props
    let appBar = viewer !== undefined

    return (
      <Document
        assets={platform.assets}
        title={pageTitle(title)}
        description={description}
        head={head}
      >
        <a href="#main" mix={skipLinkStyle}>
          Skip to content
        </a>
        <AppBar
          brand={APP_NAME}
          homeHref={routes.home.href()}
          links={appBar ? appLinks : navLinks}
          currentPath={currentPath}
          position={bar}
          actions={
            viewer ? (
              <>
                <XpPill neurons={viewer.xp} />
                <StreakPill days={viewer.streak} />
                <AvatarButton
                  initials={viewer.initials}
                  href={routes.me.index.href()}
                  current={currentPath === routes.me.index.href()}
                />
              </>
            ) : (
            <>
              <a href={routes.login.index.href()} mix={signInStyle}>
                Sign in
              </a>
              <Keycap href={routes.courses.index.href()}>Start free</Keycap>
            </>
            )
          }
        />
        <main id="main" mix={bleed ? undefined : mainStyle}>
          {children}
        </main>
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

const mainStyle = css({
  display: 'block',
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: 'var(--space-12) var(--page-gutter) var(--space-section)',
})
