import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { AppBar } from '@bits/ui/app-bar'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Document } from '@bits/ui/document'
import { Footer } from '@bits/ui/footer'
import { Keycap } from '@bits/ui/keycap'
import { NavLink } from '@bits/ui/nav-link'
import { XpPill } from '@bits/ui/xp-pill'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE } from '../config.ts'
import type { Viewer } from '../data/fixtures.ts'
import { routes } from '../routes.ts'
import { ClosingCta } from './home/closing-cta.tsx'
import { Hero } from './home/hero.tsx'
import { HowItWorks } from './home/how-it-works.tsx'
import { lessonOneHref } from './home/links.ts'
import { Modes } from './home/modes.tsx'
import { Progress } from './home/progress.tsx'
import { NeuralField } from './home/public/neural-field.tsx'
import { ThePath } from './home/the-path.tsx'

const brandName = `${APP_NAME.charAt(0).toUpperCase()}${APP_NAME.slice(1)}`

/** "Bits — learn AI by typing to it" (Main.md). */
export const homeTitle = `${brandName} — learn AI by typing to it`

const navLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: '#how', label: 'How it works' },
  { href: '#path', label: 'The path' },
  { href: routes.author.index.href(), label: 'For authors' },
]

const footerLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: routes.author.index.href(), label: 'Write a course' },
  { href: routes.login.index.href(), label: 'Sign in' },
  { href: routes.me.index.href(), label: 'Profile' },
]

/**
 * The landing page (docs/design/spec/pages/Main.md). Every section is
 * server-rendered and reads with JS off; the sticky 3D field and the hero
 * typewriter placeholder are the only islands. It renders its own shell
 * (marketing app bar, full-bleed sections, footer) rather than `Layout`.
 */
export function HomePage(handle: Handle<{ viewer: Viewer | null }>) {
  return () => {
    let { viewer } = handle.props
    let displayFont = platform.assets.fonts['unbounded-latin-800-normal.woff2']
    return (
      <Document
        assets={platform.assets}
        title={homeTitle}
        description={`${APP_TAGLINE} Free, hands-on courses from “what's a token?” to shipping your first agent.`}
        head={
          <>
            {/* The hero h1 (the LCP element) is Unbounded 800, outside the global preloads. */}
            {displayFont ? (
              <link rel="preload" as="font" type="font/woff2" href={displayFont} crossOrigin="anonymous" />
            ) : null}
            <style>{pageCss}</style>
          </>
        }
      >
        <div mix={rootStyle}>
          <a href="#main" mix={skipLinkStyle}>
            Skip to content
          </a>
          <NeuralField />
          <div mix={contentStyle}>
            <AppBar
              brand={APP_NAME}
              homeHref={routes.home.href()}
              links={navLinks}
              variant="marketing"
              position="static"
              actions={
                viewer ? (
                  <>
                    <XpPill neurons={viewer.xp} />
                    <AvatarButton initials={viewer.initials} href={routes.me.index.href()} />
                  </>
                ) : (
                  <>
                    <NavLink href={routes.login.index.href()} variant="marketing" mix={signInStyle}>
                      Sign in
                    </NavLink>
                    <Keycap href={lessonOneHref()} mix={startFreeStyle}>
                      Start free
                    </Keycap>
                  </>
                )
              }
            />
            <main id="main" tabIndex={-1} mix={mainStyle}>
              <Hero />
              <HowItWorks />
              <ThePath />
              <Modes />
              <Progress />
              <ClosingCta />
            </main>
            <Footer
              brand={APP_NAME}
              homeHref={routes.home.href()}
              links={footerLinks}
              copyright={`© 2026 ${brandName}`}
            />
          </div>
        </div>
      </Document>
    )
  }
}

// The scroll cue keyframes (Main.md §2.7) are page-specific, so they ship
// with the page instead of base.css.
const pageCss = `@layer app{@keyframes bits-cue{0%{transform:scaleY(0);transform-origin:top}45%{transform:scaleY(1);transform-origin:top}55%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}}`

const rootStyle = css({
  position: 'relative',
  background: 'var(--ink)',
  color: 'var(--text)',
  overflowX: 'clip',
})

const contentStyle = css({ position: 'relative', zIndex: 1 })

const mainStyle = css({ display: 'block', '&:focus': { outline: 'none' } })

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
  padding: '0 var(--space-2)',
  '@media (max-width: 420px)': { display: 'none' },
})

const startFreeStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4_5)',
  borderRadius: 'var(--radius-md)',
})
