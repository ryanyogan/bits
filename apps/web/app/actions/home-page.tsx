import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import type { AppBarLink } from '@bits/ui/app-bar'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { Footer, type FooterThemeOption } from '@bits/ui/footer'
import { PageFrame } from '@bits/ui/page-frame'
import { RuledSection } from '@bits/ui/ruled-section'
import { themePreference } from '@bits/ui/theme'

import { APP_NAME, APP_TAGLINE } from '../config.ts'
import type { Viewer } from '../auth/identity.ts'
import { routes } from '../routes.ts'
import { authorLinkFor, copyright, footerLinksFor, Layout } from '../ui/layout.tsx'
import { ClosingCta } from './home/closing-cta.tsx'
import type { NextStep } from './home/continue.ts'
import { Hero } from './home/hero.tsx'
import { HowItWorks } from './home/how-it-works.tsx'
import { Modes } from './home/modes.tsx'
import { Progress } from './home/progress.tsx'
import { NeuralField } from './home/public/neural-field.tsx'
import { ThePath } from './home/the-path.tsx'

/** "bits — learn AI by typing to it" (Main.md; lowercase, decision 005). */
export const homeTitle = `${APP_NAME} — learn AI by typing to it`

// The landing's content for the one header (decisions 059, 065): in-page
// section links, lit while their section is on screen, then My learning
// (signed in) and Write a course (authors).
function navLinksFor(viewer: Viewer | null): AppBarLink[] {
  return [
    { href: routes.courses.index.href(), label: 'Courses' },
    { href: '#how', label: 'How it works', section: 'how' },
    { href: '#path', label: 'The path', section: 'path' },
    ...(viewer ? [{ href: routes.me.index.href(), label: 'My learning' }] : []),
    ...authorLinkFor(viewer),
  ]
}

// The footer's theme switch (decision 062): `POST /theme`, then back here.
const themeOptions: FooterThemeOption[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

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
export function HomePage(handle: Handle<{ viewer: Viewer | null; next?: NextStep; progress?: boolean }>) {
  return () => {
    let { viewer, next } = handle.props
    let signedIn = viewer !== null
    // Signed in, or signed out with lessons done in the session (decision 070).
    let progress = signedIn || handle.props.progress === true
    return (
      <Layout
        documentTitle={homeTitle}
        canonicalPath={routes.home.href()}
        currentPath={routes.home.href()}
        description={`${APP_TAGLINE} Hands-on AI courses, free to start: from “what's a token?” to shipping your first agent.`}
        // The hero h1 (the LCP element) is Unbounded 800, outside the global preloads.
        preloadFonts={['unbounded-latin-800-normal.woff2']}
        head={<style>{pageCss}</style>}
        links={navLinksFor(viewer)}
        continueHref={next?.href}
        viewer={viewer}
        bare
      >
        <div mix={rootStyle}>
          <NeuralField />
          <PageFrame mix={contentStyle}>
            <main id="main" tabIndex={-1} mix={mainStyle}>
              <Hero signedIn={signedIn} progress={progress} next={next} />
              {next ? (
                // With progress: where they left off, right under the fold (decisions 065, 070).
                <RuledSection aria-label="Continue where you left off" pad="none">
                  <ContinueBanner
                    href={next.href}
                    courseTitle={next.courseTitle}
                    eyebrow={next.kind === 'resume' ? `Continue · lesson ${next.n} of ${next.total}` : `Start here · lesson 1 of ${next.total}`}
                    nextLesson={next.lessonTitle}
                    mins={next.mins}
                    pct={next.pct}
                    sigil={next.sigil}
                    tone={next.tone}
                    pattern={next.pattern}
                    edge="flush"
                  />
                </RuledSection>
              ) : null}
              <HowItWorks />
              <ThePath />
              <Modes />
              <Progress signedIn={signedIn} />
              <ClosingCta signedIn={signedIn} progress={progress} next={next} />
            </main>
            <RuledSection as="div" pad="none" open>
              <Footer
                brand={APP_NAME}
                homeHref={routes.home.href()}
                links={footerLinksFor(viewer)}
                copyright={copyright}
                themes={{ current: themePreference(handle), action: routes.theme.action.href(), options: themeOptions }}
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
