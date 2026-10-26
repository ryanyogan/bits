import { css, type Handle } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../routes.ts'
import { lessonOneHref } from './links.ts'
import { monoNote, PHONE } from './styles.ts'

/** Closing CTA (Main.md §7). */
export function ClosingCta(_handle: Handle) {
  return () => (
    <section aria-labelledby="cta-title" mix={ctaStyle}>
      <h2 id="cta-title" mix={titleStyle}>
        Your first prompt is waiting.
      </h2>
      <div mix={buttons}>
        <Keycap size="lg" glow href={lessonOneHref()} mix={button}>
          Start lesson 1 →
        </Keycap>
        <Keycap size="lg" variant="dark" href={routes.courses.index.href()} mix={button}>
          Browse courses
        </Keycap>
      </div>
      <p mix={monoNote}>Free forever · progress saves when you sign in</p>
    </section>
  )
}

const ctaStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: '160px var(--page-gutter) 140px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 'var(--space-9)',
  [PHONE]: { padding: 'var(--space-24) var(--page-gutter) var(--space-20)' },
})

const titleStyle = css({
  margin: 0,
  maxWidth: '1000px',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(42px, 7vw, 104px)',
  lineHeight: 0.96,
  letterSpacing: 'var(--tracking-display)',
  textWrap: 'balance',
})

const buttons = css({
  display: 'flex',
  gap: 'var(--space-3_5)',
  flexWrap: 'wrap',
  justifyContent: 'center',
  [PHONE]: { width: '100%' },
})

const button = css({ gap: 'var(--space-2_5)', [PHONE]: { flex: '1 1 100%' } })
