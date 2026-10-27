import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { AvatarButton } from '@bits/ui/avatar-button'
import { Document } from '@bits/ui/document'
import { Footer } from '@bits/ui/footer'
import { Keycap } from '@bits/ui/keycap'
import { XpPill } from '@bits/ui/xp-pill'

import { platform } from '#platform'

import { APP_NAME, APP_TAGLINE } from '../config.ts'
import type { Viewer } from '../auth/identity.ts'
import { routes } from '../routes.ts'
import { HOME_ALT, ogImage } from '../ui/og.ts'
import { canonicalUrl } from '../ui/layout.tsx'
import { ClosingCta } from './home/closing-cta.tsx'
import { Hero } from './home/hero.tsx'
import { HowItWorks } from './home/how-it-works.tsx'
import { LandingHeader, type LandingLink, navLinkStyle } from './home/landing-header.tsx'
import { lessonOneHref } from './home/links.ts'
import { Modes } from './home/modes.tsx'
import { Progress } from './home/progress.tsx'
import { NeuralField } from './home/public/neural-field.tsx'
import { PHONE, prefetch } from './home/styles.ts'
import { ThePath } from './home/the-path.tsx'

const brandName = `${APP_NAME.charAt(0).toUpperCase()}${APP_NAME.slice(1)}`

/** "Bits — learn AI by typing to it" (Main.md). */
export const homeTitle = `${brandName} — learn AI by typing to it`

const navLinks: LandingLink[] = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: '#how', label: 'How it works', section: 'how' },
  { href: '#path', label: 'The path', section: 'path' },
  { href: routes.author.index.href(), label: 'For authors' },
]

const footerLinks = [
  { href: routes.courses.index.href(), label: 'Courses' },
  { href: routes.author.index.href(), label: 'Write a course' },
  { href: routes.login.index.href(), label: 'Sign in' },
  { href: routes.me.index.href(), label: 'Profile' },
  { href: routes.legal.terms.href(), label: 'Terms' },
  { href: routes.legal.privacy.href(), label: 'Privacy' },
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
        image={ogImage('home', HOME_ALT)}
        url={canonicalUrl(routes.home.href())}
        siteName={APP_NAME}
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
            <LandingHeader
              brand={APP_NAME}
              homeHref={routes.home.href()}
              links={navLinks}
              menuExtras={viewer ? [] : [{ href: routes.login.index.href(), label: 'Sign in' }]}
              actions={
                viewer ? (
                  <>
                    <XpPill neurons={viewer.xp} />
                    <AvatarButton initials={viewer.initials} href={routes.me.index.href()} mix={prefetch} />
                  </>
                ) : (
                  <>
                    <a href={routes.login.index.href()} mix={[navLinkStyle, signInStyle, prefetch]}>
                      Sign in
                    </a>
                    <Keycap href={lessonOneHref()} mix={[startFreeStyle, prefetch]}>
                      Start free
                    </Keycap>
                  </>
                )
              }
            />
            <main id="main" tabIndex={-1} mix={mainStyle}>
              <Hero signedIn={viewer !== null} />
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

// Page-specific keyframes ship with the page instead of base.css:
// - bits-cue: the scroll cue (Main.md §2.7);
// - landing-bar: the header frosting over the first 120px of scroll;
// - landing-here: a section link while its section is on screen;
// - landing-trace: the path's dashed line drawing in (the-path.tsx).
// (decision 040)
const pageCss = [
  '@keyframes bits-cue{0%{transform:scaleY(0);transform-origin:top}45%{transform:scaleY(1);transform-origin:top}55%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}',
  '@keyframes landing-bar{from{background-color:transparent;border-bottom-color:transparent}to{background-color:var(--appbar-bg);border-bottom-color:var(--line-bar);-webkit-backdrop-filter:blur(var(--blur-glass));backdrop-filter:blur(var(--blur-glass))}}',
  '@keyframes landing-here{from,to{color:var(--text);background-color:var(--fill-ghost-hover)}}',
  '@keyframes landing-trace{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
]
  .map((rule) => `@layer app{${rule}}`)
  .join('')

const rootStyle = css({
  position: 'relative',
  background: 'var(--ink)',
  color: 'var(--text)',
  overflowX: 'clip',
  // The header's section links read the #how / #path view timelines.
  timelineScope: '--how, --path',
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

// Under 420px the bar keeps Start free and the menu; Sign in moves into the
// menu sheet (menuExtras), so it is never out of reach.
const signInStyle = css({ '@media (max-width: 420px)': { display: 'none' } })

const startFreeStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4_5)',
  borderRadius: 'var(--radius-md)',
  [PHONE]: { padding: '0 var(--space-4)' },
})
