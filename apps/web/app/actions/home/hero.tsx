import { css, type Handle } from 'remix/component'
import { SuggestionChip } from '@bits/ui/chip'

import { agentLessonHref, lessonOneHref } from './links.ts'
import { FieldMotionToggle } from './public/field-motion-toggle.tsx'
import { HeroPromptInput } from './public/hero-prompt-input.tsx'
import { dotBreak, FORCED, monoNote, PHONE, REDUCED, voltText } from './styles.ts'

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
 *
 * The h1 never animates (it is the LCP element). The lines around it rise in
 * once on load, CSS only (decision 040).
 */
export function Hero(handle: Handle<{ signedIn?: boolean }>) {
  return () => (
    <section aria-labelledby="hero-title" mix={heroStyle}>
      <p mix={[badgeStyle, rise[0]]}>
        <span aria-hidden="true" mix={pulseDot} />
        Free courses · from zero to your first agent
      </p>
      <h1 id="hero-title" mix={h1Style}>
        Learn AI by <span mix={voltText}>typing</span> to it.
        <span aria-hidden="true" mix={caretStyle} />
      </h1>
      <p mix={[subStyle, rise[1]]}>
        Free, hands-on courses that take you from “what's a token?” to shipping your first agent.
        Every lesson is a conversation — you write the prompts, run the code, and watch the model
        think.
      </p>

      <form method="get" action={lessonOneHref()} mix={[barStyle, rise[2]]}>
        <span aria-hidden="true" mix={chevronStyle}>
          ›
        </span>
        <label for="hero-prompt" class="sr-only">
          Ask your first question
        </label>
        <HeroPromptInput id="hero-prompt" name="q" prompts={typewriterPrompts} />
        <button type="submit" mix={askStyle}>
          Ask
          <span aria-hidden="true" mix={enterTile}>
            ↵
          </span>
        </button>
      </form>

      <ul aria-label="Try asking" mix={[chipsStyle, rise[3]]}>
        {suggestions.map((s) => (
          <li key={s.label}>
            <SuggestionChip href={s.href} mix={chipStyle}>
              {s.label}
            </SuggestionChip>
          </li>
        ))}
      </ul>

      <p mix={[monoNote, noteStyle, rise[4]]}>
        {/* The signed-in line fits one phone line, so it stays plain text. */}
        {handle.props.signedIn ? (
          'Signed in · your progress saves as you go'
        ) : (
          <>
            No account needed to start<span mix={dotBreak}> · </span>sign in to save progress
          </>
        )}
      </p>

      <div mix={[cueStyle, rise[5]]}>
        <div aria-hidden="true" mix={cueTextStyle}>
          Scroll — the network rewires itself
          <span mix={cueLine} />
        </div>
        {/* Pauses the field's own motion (WCAG 2.2.2, decision 034). */}
        <FieldMotionToggle />
      </div>
    </section>
  )
}

/**
 * The page's one load sequence: each line around the h1 rises in 70ms after
 * the last. Opacity and transform only, so nothing shifts layout; reduced
 * motion shows everything at once.
 */
const rise = [0, 1, 2, 3, 4, 5].map((i) =>
  css({
    animation: `bits-rise var(--duration-pop) var(--ease-out) ${i * 70}ms both`,
    [REDUCED]: { animation: 'none' },
  }),
)

const heroStyle = css({
  maxWidth: 'var(--page-max)',
  margin: '0 auto',
  // Spec: 104px top, 820px tall. The height is capped by the viewport so
  // the scroll cue and pause control stay above the fold on a laptop.
  padding: 'var(--space-24) var(--page-gutter) var(--space-18)',
  minHeight: 'min(820px, calc(100svh - var(--appbar-h)))',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 'var(--space-7)',
  [PHONE]: {
    padding: 'var(--space-12) var(--page-gutter) var(--space-12)',
    minHeight: 'auto',
    gap: 'var(--space-6)',
  },
})

const badgeStyle = css({
  margin: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  padding: 'var(--space-2) var(--space-4) var(--space-2) var(--space-3)',
  border: '1px solid var(--volt-a28)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(var(--space-2_5))',
  backdropFilter: 'blur(var(--space-2_5))',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
  textAlign: 'left',
  textWrap: 'balance',
  // The 13px line is ~330px wide: on a 360px phone it wrapped into a
  // two-line pill. 11px with title tracking keeps it on one line.
  [PHONE]: {
    gap: 'var(--space-2)',
    padding: 'var(--space-1_5) var(--space-3) var(--space-1_5) var(--space-2_5)',
    fontSize: 'var(--fs-11)',
    letterSpacing: 'var(--tracking-title)',
  },
})

const pulseDot = css({
  flex: 'none',
  display: 'block',
  width: 'var(--space-2)',
  height: 'var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--volt)',
  animation: 'bits-pulse-volt var(--duration-pulse) ease-in-out infinite',
  [REDUCED]: { animation: 'none' },
  [FORCED]: { forcedColorAdjust: 'none', background: 'CanvasText' },
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
  [REDUCED]: { display: 'none' },
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

/*
 * The prompt bar (components §7.4), reworked in decision 040.
 *
 * One row, everything centred on it. The Ask key's edge is drawn inside the
 * key (an inset shadow), so its box is what you see and the insets around
 * it are equal: 8px on desktop, 6px on phones. Radii nest: bar = key
 * radius (10) + inset, so 18 (`--radius-xl`) and 16. The chevron uses the
 * input's font, size and line box, so its glyph sits on the text's line
 * instead of floating in a taller 20px line.
 */
const barStyle = css({
  width: '100%',
  maxWidth: 'var(--read-width)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-5)',
  boxSizing: 'border-box',
  // Glass over the field: translucent ink, blurred and a little saturated,
  // so the field glows through without drawing lines behind the text.
  background: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(var(--blur-prompt)) saturate(1.4)',
  backdropFilter: 'blur(var(--blur-prompt)) saturate(1.4)',
  border: '1px solid var(--volt-a28)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'inset 0 1px 0 var(--line-glass), var(--shadow-prompt-bar)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:hover': { borderColor: 'var(--volt-a40)' },
  '&:focus-within': {
    borderColor: 'var(--volt-a60)',
    boxShadow: 'inset 0 1px 0 var(--line-glass), var(--focus-ring), var(--shadow-prompt-bar)',
  },
  // Without backdrop-filter the bar would be see-through: make it solid.
  '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
    background: 'var(--glass-82)',
  },
  [FORCED]: {
    background: 'Canvas',
    borderColor: 'CanvasText',
    '&:focus-within': { outline: '2px solid Highlight', outlineOffset: '2px' },
  },
  [PHONE]: {
    gap: 'var(--space-2_5)',
    padding: 'var(--space-1_5) var(--space-1_5) var(--space-1_5) var(--space-4)',
    borderRadius: 'var(--radius-16)',
  },
})

const chevronStyle = css({
  flex: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-17)',
  fontWeight: 500,
  lineHeight: 'normal',
  color: 'var(--volt)',
  [PHONE]: { fontSize: 'var(--fs-16)' },
})

const askStyle = css({
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 'var(--space-12)',
  padding: '0 var(--space-3) 0 var(--space-4)',
  boxSizing: 'border-box',
  border: 0,
  borderRadius: 'var(--radius-10)',
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  // The keycap edge, inside the key: 2px of --volt-edge along the bottom.
  boxShadow: 'inset 0 calc(-1 * var(--space-0_5)) 0 var(--volt-edge), inset 0 1px 0 var(--inset-highlight)',
  transition:
    'background-color var(--duration-press) var(--ease), box-shadow var(--duration-press) var(--ease), transform var(--duration-press) var(--ease)',
  '&:hover': { background: 'var(--volt-hover)' },
  '&:active': { transform: 'translateY(1px)', boxShadow: 'inset 0 1px 0 var(--volt-edge)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  '&[aria-busy="true"]': { cursor: 'progress' },
  [REDUCED]: { transition: 'none' },
  [FORCED]: { border: '1px solid ButtonText' },
  [PHONE]: { minHeight: 'var(--touch-target)', padding: '0 var(--space-2_5) 0 var(--space-3_5)' },
})

const enterTile = css({
  display: 'inline-grid',
  placeItems: 'center',
  minWidth: 'var(--space-6)',
  height: 'var(--space-6)',
  boxSizing: 'border-box',
  padding: '0 var(--space-1_5)',
  borderRadius: 'var(--radius-5)',
  background: 'var(--on-volt-a12)',
  fontSize: 'var(--fs-12)',
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
  [PHONE]: { gap: 'var(--space-2)' },
})

// Chips sit on the field too: give them the badge's glass so they read.
const chipStyle = css({
  minHeight: 'var(--touch-target)',
  background: 'var(--ink-a60)',
  WebkitBackdropFilter: 'blur(var(--space-2_5))',
  backdropFilter: 'blur(var(--space-2_5))',
})

const noteStyle = css({ marginTop: 'var(--space-1_5)' })

const cueStyle = css({
  marginTop: 'auto',
  paddingTop: 'var(--space-14)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-5)',
  [PHONE]: { paddingTop: 'var(--space-6)', gap: 'var(--space-4)' },
})

const cueTextStyle = css({
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
  height: 'var(--space-12)',
  background: 'var(--volt)',
  animation: 'bits-cue 2.4s ease-in-out infinite',
  [REDUCED]: { animation: 'none' },
  [FORCED]: { forcedColorAdjust: 'none', background: 'CanvasText' },
  [PHONE]: { height: 'var(--space-8)' },
})
