import { css, type Handle } from 'remix/component'
import { SuggestionChip } from '@bits/ui/chip'
import { Keycap } from '@bits/ui/keycap'

import { agentLessonHref, lessonOneHref } from './links.ts'
import { HeroPromptInput } from './public/hero-prompt-input.tsx'
import { monoNote, PHONE, voltText } from './styles.ts'

export const typewriterPrompts = [
  "Explain tokens like I'm ten",
  'Why do models make things up?',
  'Write a haiku about gradient descent',
  'Build me an agent that plans dinner',
]

const suggestions = [
  { label: "Explain tokens like I'm ten", href: lessonOneHref("Explain tokens like I'm ten") },
  { label: 'Why do models make things up?', href: lessonOneHref('Why do models make things up?') },
  { label: 'Build me a tiny agent', href: agentLessonHref('Build me a tiny agent') },
]

/**
 * Hero (Main.md §2). Everything here is server-rendered so the headline is
 * the LCP paint with no JS; only the prompt input's typewriter placeholder
 * hydrates. The prompt bar is a GET form to lesson 1 with `?q=`.
 */
export function Hero(_handle: Handle) {
  return () => (
    <section aria-labelledby="hero-title" mix={heroStyle}>
      <p mix={badgeStyle}>
        <span aria-hidden="true" mix={pulseDot} />
        Free courses · from zero to your first agent
      </p>
      <h1 id="hero-title" mix={h1Style}>
        Learn AI by <span mix={voltText}>typing</span> to it.
        <span aria-hidden="true" mix={caretStyle} />
      </h1>
      <p mix={subStyle}>
        Free, hands-on courses that take you from “what's a token?” to shipping your first agent.
        Every lesson is a conversation — you write the prompts, run the code, and watch the model
        think.
      </p>

      <form method="get" action={lessonOneHref()} mix={barStyle}>
        <span aria-hidden="true" mix={chevronStyle}>
          ›
        </span>
        <label for="hero-prompt" class="sr-only">
          Ask your first question
        </label>
        <HeroPromptInput id="hero-prompt" name="q" prompts={typewriterPrompts} />
        <Keycap type="submit" mix={askStyle}>
          Ask
          <span aria-hidden="true" mix={enterTile}>
            ↵
          </span>
        </Keycap>
      </form>

      <ul aria-label="Try asking" mix={chipsStyle}>
        {suggestions.map((s) => (
          <li key={s.label}>
            <SuggestionChip href={s.href}>{s.label}</SuggestionChip>
          </li>
        ))}
      </ul>

      <p mix={[monoNote, noteStyle]}>No account needed to start · sign in to save progress</p>

      <div aria-hidden="true" mix={cueStyle}>
        Scroll — the network rewires itself
        <span mix={cueLine} />
      </div>
    </section>
  )
}

const heroStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  padding: '104px var(--page-gutter) var(--space-18)',
  minHeight: '820px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '30px',
  [PHONE]: { padding: 'var(--space-16) var(--page-gutter) var(--space-12)', minHeight: 'auto' },
})

const badgeStyle = css({
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-2) var(--space-4) var(--space-2) var(--space-3)',
  border: '1px solid var(--volt-a28)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(10px)',
  backdropFilter: 'blur(10px)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  textAlign: 'left',
})

const pulseDot = css({
  flex: 'none',
  display: 'block',
  width: '8px',
  height: '8px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--volt)',
  animation: 'bits-pulse-volt var(--duration-pulse) ease-in-out infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

const h1Style = css({
  margin: 0,
  maxWidth: '1100px',
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
  '@media (prefers-reduced-motion: reduce)': { display: 'none' },
})

const subStyle = css({
  margin: 0,
  maxWidth: '640px',
  fontSize: 'var(--fs-20)',
  lineHeight: 1.55,
  color: 'var(--text-lead)',
  textWrap: 'pretty',
  [PHONE]: { fontSize: 'var(--fs-17)' },
})

const barStyle = css({
  width: '100%',
  maxWidth: 'var(--read-width)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2_5) var(--space-2_5) var(--space-2_5) var(--space-5_5)',
  boxSizing: 'border-box',
  background: 'var(--glass)',
  WebkitBackdropFilter: 'blur(var(--blur-prompt))',
  backdropFilter: 'blur(var(--blur-prompt))',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-prompt-bar)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:focus-within': {
    borderColor: 'var(--volt-a60)',
    boxShadow: '0 0 0 4px var(--volt-tint-on), var(--shadow-prompt-bar)',
  },
  [PHONE]: { padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)', gap: 'var(--space-2_5)' },
})

const chevronStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-20)',
  color: 'var(--volt)',
})

const askStyle = css({
  minHeight: '48px',
  padding: '0 var(--space-4_5)',
  gap: 'var(--space-2_5)',
  borderRadius: 'var(--radius-md)',
})

const enterTile = css({
  padding: '2px 6px',
  borderRadius: 'var(--radius-5)',
  background: 'var(--on-volt-a12)',
  fontSize: 'var(--fs-12)',
  [PHONE]: { display: 'none' },
})

const chipsStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  justifyContent: 'center',
  maxWidth: 'var(--read-width)',
})

const noteStyle = css({ marginTop: 'var(--space-1_5)' })

const cueStyle = css({
  marginTop: 'auto',
  paddingTop: 'var(--space-14)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  letterSpacing: 'var(--tracking-cue)',
  textTransform: 'uppercase',
  color: 'var(--dim)',
})

const cueLine = css({
  display: 'block',
  width: '1px',
  height: '48px',
  background: 'var(--volt)',
  animation: 'bits-cue 2.4s ease-in-out infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
