import { css, type Handle } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { RuledSection } from '@bits/ui/ruled-section'

import { routes } from '../../routes.ts'
import { lessonOneHref } from './links.ts'
import { dotBreak, monoNote, PHONE } from './styles.ts'

/** Closing CTA (Main.md §7): one wide band, centred, the field glowing through. */
export function ClosingCta(_handle: Handle) {
  return () => (
    <RuledSection aria-labelledby="cta-title" pad="none">
      <div mix={ctaStyle}>
        <h2 id="cta-title" mix={titleStyle}>
          Your first prompt is waiting.
        </h2>
        <div mix={buttons}>
          <Keycap size="lg" href={lessonOneHref()} mix={button}>
            Start lesson 1 →
          </Keycap>
          <Keycap size="lg" variant="dark" href={routes.courses.index.href()} mix={button}>
            Browse courses
          </Keycap>
        </div>
        <p mix={monoNote}>
          Free forever<span mix={dotBreak}> · </span>progress saves when you sign in
        </p>
      </div>
    </RuledSection>
  )
}

const ctaStyle = css({
  // Spec: 160px top, 140px bottom.
  padding: 'calc(var(--space-30) + var(--space-10)) var(--section-pad-x) calc(var(--space-30) + var(--space-5))',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 'var(--space-9)',
  [PHONE]: { padding: 'var(--space-24) var(--section-pad-x) var(--space-20)' },
})

const titleStyle = css({
  margin: 0,
  maxWidth: 'var(--type-display-cta-measure)',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--type-display-cta-size)',
  lineHeight: 'var(--type-display-cta-leading)',
  letterSpacing: 'var(--tracking-display)',
  textWrap: 'balance',
})

const buttons = css({
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  justifyContent: 'center',
  [PHONE]: { width: '100%' },
})

const button = css({ gap: 'var(--space-2_5)', [PHONE]: { flex: '1 1 100%' } })
