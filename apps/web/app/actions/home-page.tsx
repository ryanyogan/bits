import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { APP_TAGLINE } from '../config.ts'
import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'

/**
 * Landing page placeholder. The Main artboard (hero prompt bar, 3D field,
 * how-it-works, the path) replaces this in the landing milestone.
 */
export function HomePage(_handle: Handle) {
  return () => (
    <Layout bar="static" currentPath={routes.home.href()}>
      <section mix={heroStyle} aria-labelledby="hero-title">
        <p mix={eyebrowStyle}>01 — Neurons</p>
        <h1 id="hero-title" mix={displayStyle}>
          Learn AI
        </h1>
        <p mix={ledeStyle}>
          {APP_TAGLINE} Free, from “what’s a token?” to shipping your first agent. Every lesson is
          a conversation.
        </p>
        <div mix={actionsStyle}>
          <Keycap size="lg" href={routes.courses.index.href()}>
            Start lesson →
          </Keycap>
          <Keycap size="lg" variant="dark" href={routes.courses.index.href()}>
            Browse courses
          </Keycap>
          <Keycap variant="ghost" href={routes.login.index.href()}>
            Sign in
          </Keycap>
        </div>
      </section>
      <section id="how" mix={sectionStyle} aria-labelledby="how-title">
        <p mix={eyebrowStyle}>02 — How it works</p>
        <h2 id="how-title" mix={h2Style}>
          Every lesson is a conversation.
        </h2>
        <p mix={ledeStyle}>Placeholder. The landing page is built in milestone 1.</p>
      </section>
    </Layout>
  )
}

const heroStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '30px',
  padding: 'var(--space-16) 0',
})

const eyebrowStyle = css({
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  fontSize: 'var(--type-eyebrow-size)',
  letterSpacing: 'var(--type-eyebrow-tracking)',
  textTransform: 'uppercase',
  color: 'var(--ion)',
})

const displayStyle = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--type-display-xl-size)',
  lineHeight: 'var(--type-display-xl-leading)',
  letterSpacing: 'var(--type-display-xl-tracking)',
})

const h2Style = css({
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--type-h2-size)',
  lineHeight: 'var(--type-h2-leading)',
  letterSpacing: 'var(--type-h2-tracking)',
})

const ledeStyle = css({
  maxWidth: '60ch',
  fontSize: '18px',
  lineHeight: 1.6,
  color: 'var(--muted)',
})

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '14px',
})

const sectionStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  paddingTop: 'var(--space-section)',
})
