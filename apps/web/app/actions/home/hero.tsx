import { css, type Handle } from 'remix/component'
import { SuggestionChip } from '@bits/ui/chip'
import { Keycap } from '@bits/ui/keycap'
import { RuledSection } from '@bits/ui/ruled-section'

import { routes } from '../../routes.ts'
import type { NextStep } from './continue.ts'
import { heroQuestions, lessonOneHref, questionHref } from './links.ts'
import { FieldMotionToggle } from './public/field-motion-toggle.tsx'
import { centreWash, dotBreak, monoNote, PHONE, REDUCED, voltText } from './styles.ts'

export interface HeroProps {
  signedIn?: boolean
  /** Signed in: the learner's next lesson (decision 065). */
  next?: NextStep
}

/**
 * Hero (Main.md §2; decision 065). Everything here is server-rendered, so
 * the headline is the LCP paint with no JS.
 *
 * No prompt box: nothing typed there would reach a lesson, so the hero only
 * offers what a click delivers. The primary key starts lesson 1 (or, signed
 * in, the next lesson), and the questions are links to the lessons that
 * answer them.
 *
 * It is the first band of the page's ruled frame (decision 047) and has no
 * rule of its own: the header's rule closes it from above. The neural field
 * shows through it; everything on top sits on flat ink (`--cell-fill`).
 *
 * The h1 never animates (it is the LCP element). The lines around it rise in
 * once on load, CSS only (decision 040).
 */
export function Hero(handle: Handle<HeroProps>) {
  return () => {
    let { signedIn, next } = handle.props
    // Signed in with every started course finished, there is no next
    // lesson: the course list is the one key.
    let primary = next
      ? { href: next.href, label: next.kind === 'resume' ? `Continue lesson ${next.n}` : 'Start lesson 1' }
      : signedIn
        ? undefined
        : { href: lessonOneHref(), label: 'Start lesson 1' }
    return (
      // The hero continues the header's block (decision 050): no gap above it,
      // the header's rule closes it from above, its own rule closes the fold.
      <RuledSection as="div" rule={false} pad="none" open>
        <section aria-labelledby="hero-title" mix={[heroStyle, centreWash]}>
          <h1 id="hero-title" mix={h1Style}>
            Learn AI by <span mix={voltText}>typing</span> to it.
            <span aria-hidden="true" mix={caretStyle} />
          </h1>
          <p mix={[subStyle, rise[0]]}>
            Hands-on courses from “what's a token?” to your first agent. You write the prompts, run the
            code, and watch the model think.
          </p>

          <div mix={[ctaRow, rise[1]]}>
            {primary ? (
              <Keycap size="lg" href={primary.href} mix={ctaKey}>
                {primary.label} <span aria-hidden="true">→</span>
              </Keycap>
            ) : null}
            <Keycap size="lg" variant={primary ? 'dark' : 'primary'} href={routes.courses.index.href()} mix={ctaKey}>
              Browse courses
            </Keycap>
          </div>

          <div mix={[questionsStyle, rise[2]]}>
            <p id="hero-questions" mix={[monoNote, questionsLabel]}>
              Or jump to a question
            </p>
            {/* On phones the chips are one row that scrolls sideways: focusable, named by its label. */}
            <ul aria-labelledby="hero-questions" tabIndex={0} mix={chipsStyle}>
              {heroQuestions.map((q) => (
                <li key={q.label}>
                  <SuggestionChip href={questionHref(q)} mix={chipStyle}>
                    {q.label}
                  </SuggestionChip>
                </li>
              ))}
            </ul>
          </div>

          <p mix={[monoNote, noteStyle, rise[3]]}>
            {/* The signed-in line fits one phone line, so it stays plain text. */}
            {signedIn ? (
              'Signed in · your progress saves as you go'
            ) : (
              <>
                Free to start<span mix={dotBreak}> · </span>no account needed
                <span mix={dotBreak}> · </span>sign in to save progress
              </>
            )}
          </p>

          <div mix={[cueStyle, rise[4]]}>
            {/* Pauses the field's own motion (WCAG 2.2.2, decision 034). */}
            <FieldMotionToggle />
          </div>
        </section>
      </RuledSection>
    )
  }
}

/**
 * The page's one load sequence: each line around the h1 rises in 70ms after
 * the last. Opacity and transform only, so nothing shifts layout; reduced
 * motion shows everything at once.
 */
const rise = [0, 1, 2, 3, 4].map((i) =>
  css({
    animation: `bits-rise var(--duration-pop) var(--ease-out) ${i * 70}ms both`,
    [REDUCED]: { animation: 'none' },
  }),
)

const heroStyle = css({
  // One full fold (decision 048): the scroll cue and pause control sit on
  // its bottom edge (they take `margin-top: auto`); at 1440×900 the content
  // just fits (64 top, 32 bottom). Phones size to content.
  padding: 'var(--space-16) var(--section-pad-x) var(--space-8)',
  minHeight: 'calc(100svh - var(--appbar-h))',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 'var(--space-8)',
  [PHONE]: {
    padding: 'var(--space-10) var(--section-pad-x) var(--space-8)',
    minHeight: 'auto',
    gap: 'var(--space-6)',
  },
})

const h1Style = css({
  margin: 0,
  maxWidth: 'var(--type-display-xl-measure)',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--type-display-xl-size)',
  lineHeight: 'var(--type-display-xl-leading)',
  letterSpacing: 'var(--type-display-xl-tracking)',
  textWrap: 'balance',
})

const caretStyle = css({
  display: 'inline-block',
  width: '0.09em',
  height: '0.82em',
  marginLeft: '0.06em',
  background: 'var(--volt)',
  verticalAlign: '-0.04em',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  // Handoff: hide the caret entirely under reduced motion.
  [REDUCED]: { display: 'none' },
})

const subStyle = css({
  margin: 0,
  maxWidth: 'var(--read-width)',
  fontSize: 'var(--fs-19)',
  lineHeight: 1.55,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
  [PHONE]: { fontSize: 'var(--fs-17)' },
})

const ctaRow = css({
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  justifyContent: 'center',
  [PHONE]: { width: '100%' },
})

const ctaKey = css({ gap: 'var(--space-2_5)', [PHONE]: { flex: '1 1 100%' } })

const questionsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-3)',
  width: '100%',
  maxWidth: 'var(--read-width)',
})

const questionsLabel = css({ margin: 0 })

const chipsStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
  justifyContent: 'center',
  maxWidth: 'var(--read-width)',
  // Phones: one row that scrolls sideways and bleeds to the rails (decision 048).
  [PHONE]: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    justifyContent: 'flex-start',
    width: 'calc(100% + 2 * var(--section-pad-x))',
    maxWidth: 'none',
    boxSizing: 'border-box',
    marginInline: 'calc(-1 * var(--section-pad-x))',
    paddingInline: 'var(--section-pad-x)',
    scrollbarWidth: 'none',
    '& > li': { flex: 'none' },
    '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  },
})

// Chips sit on the field too: give them the flat ink ground so they read.
const chipStyle = css({
  minHeight: 'var(--touch-target)',
  background: 'var(--cell-fill)',
})

const noteStyle = css({ marginTop: 'var(--space-1_5)' })

const cueStyle = css({
  marginTop: 'auto',
  paddingTop: 'var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-4)',
  [PHONE]: { paddingTop: 'var(--space-6)', gap: 'var(--space-4)' },
})
