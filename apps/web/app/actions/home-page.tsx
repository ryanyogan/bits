import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import type { AppBarLink } from '@bits/ui/app-bar'
import { Footer, type FooterThemeLink } from '@bits/ui/footer'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'
import { themePreference } from '@bits/ui/theme'

import { APP_NAME, APP_TAGLINE } from '../config.ts'
import type { Viewer } from '../auth/identity.ts'
import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
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

// The landing's content for the one header (decision 059): in-page
// section links, lit while their section is on screen.
const navLinks: AppBarLink[] = [
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

// The footer's theme switch (decision 062): `?theme=` saves the choice and
// redirects back to the landing without it.
const themeLinks: FooterThemeLink[] = (
  [
    ['system', 'System'],
    ['dark', 'Dark'],
    ['light', 'Light'],
  ] as const
).map(([value, label]) => ({ value, label, href: routes.home.href(undefined, { searchParams: { theme: value } }) }))

/**
 * The landing page (docs/design/spec/pages/Main.md). Every section is
 * server-rendered and reads with JS off; the sticky 3D field and the hero
 * typewriter placeholder are the only islands. It renders through `Layout`
 * (`bare`) with the same header as every page, holding its own links
 * (decision 059).
 *
 * Squared grid (decision 047): the field fills the screen behind one
 * `PageFrame`; every section and the footer are bands of that frame,
 * divided by full-bleed rules with `+` marks on the rails.
 */
export function HomePage(handle: Handle<{ viewer: Viewer | null }>) {
  return () => {
    let { viewer } = handle.props
    return (
      <Layout
        documentTitle={homeTitle}
        canonicalPath={routes.home.href()}
        currentPath={routes.home.href()}
        description={`${APP_TAGLINE} Hands-on AI courses, free to start: from “what's a token?” to shipping your first agent.`}
        // The hero h1 (the LCP element) is Unbounded 800, outside the global preloads.
        preloadFonts={['unbounded-latin-800-normal.woff2']}
        head={<style>{pageCss}</style>}
        links={navLinks}
        startHref={lessonOneHref()}
        viewer={viewer}
        bare
      >
        <div mix={rootStyle}>
          <NeuralField />
          <PageFrame mix={contentStyle}>
            <main id="main" tabIndex={-1} mix={mainStyle}>
              <Hero signedIn={viewer !== null} />
              <HowItWorks />
              <ThePath />
              <Modes />
              <Progress />
              <ClosingCta />
            </main>
            <RuledSection as="div" pad="none">
              <Footer
                brand={APP_NAME}
                homeHref={routes.home.href()}
                links={footerLinks}
                copyright={`© 2026 ${brandName}`}
                themes={{ current: themePreference(handle), links: themeLinks }}
                mix={footerStyle}
              />
            </RuledSection>
          </PageFrame>
        </div>
      </Layout>
    )
  }
}

// Page-specific keyframes ship with the page instead of base.css:
// - bits-cue: the scroll cue (Main.md §2.7);
// - landing-trace: the path's dashed line drawing in (the-path.tsx).
// (decision 040) The header sits outside the page root (Layout renders
// it), so the #how / #path view timelines its section links read are
// scoped on body (decision 059).
const pageCss = [
  '@keyframes bits-cue{0%{transform:scaleY(0);transform-origin:top}45%{transform:scaleY(1);transform-origin:top}55%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}',
  '@keyframes landing-trace{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
  'body{timeline-scope:--how,--path}',
]
  .map((rule) => `@layer app{${rule}}`)
  .join('')

const rootStyle = css({
  position: 'relative',
  background: 'var(--ink)',
  color: 'var(--text)',
  overflowX: 'clip',
})

const contentStyle = css({ position: 'relative', zIndex: 1 })

const mainStyle = css({ display: 'block', '&:focus': { outline: 'none' } })

// The footer is the frame's last band: the band's rule replaces its border.
const footerStyle = css({ borderTop: 0, background: 'var(--cell-fill)' })
