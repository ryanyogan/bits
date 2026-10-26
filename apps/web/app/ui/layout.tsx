import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { Document } from '@bits/ui/document'
import { Keycap } from '@bits/ui/keycap'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE, pageTitle } from '../config.ts'
import { routes } from '../routes.ts'

export interface LayoutProps {
  /** Page name; the document title becomes "<title> · bits". Omit on the landing page. */
  title?: string
  description?: string
  /** Pathname of this page, to mark the active nav link. */
  currentPath?: string
  /** `sticky` for app pages, `static` over the landing hero. */
  bar?: 'static' | 'sticky'
  head?: RemixNode
  children?: RemixNode
}

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
    let { title, description = APP_TAGLINE, currentPath, bar = 'sticky', head, children } =
      handle.props

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
          links={navLinks}
          currentPath={currentPath}
          position={bar}
          actions={
            <>
              <a href={routes.login.index.href()} mix={signInStyle}>
                Sign in
              </a>
              <Keycap href={routes.courses.index.href()}>Start free</Keycap>
            </>
          }
        />
        <main id="main" mix={mainStyle}>
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
  color: 'var(--text-nav)',
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
