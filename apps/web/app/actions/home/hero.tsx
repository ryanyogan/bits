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
 * It is the first band of the page's ruled frame (decision 047) and has no
 * rule of its own: the header's rule closes it from above. The neural field
 * shows through it; everything on top sits on flat ink (`--cell-fill`).
 *
 * The h1 never animates (it is the LCP element). The lines around it rise in
 * once on load, CSS only (decision 040).
 */
export function Hero(handle: Handle<{ signedIn?: boolean }>) {
  return () => (
    <section aria-labelledby="hero-title" mix={heroStyle}>
      <h1 id="hero-title" mix={h1Style}>
        Learn AI by <span mix={voltText}>typing</span> to it.
        <span aria-hidden="true" mix={caretStyle} />
      </h1>
      <p mix={[subStyle, rise[0]]}>
        Hands-on courses from “what's a token?” to your first agent. You write the prompts, run the
        code, and watch the model think.
      </p>

      <form method="get" action={lessonOneHref()} mix={[barStyle, rise[1]]}>
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

      {/* On phones the chips are one row that scrolls sideways: focusable, named by its label. */}
      <ul aria-label="Try asking" tabIndex={0} mix={[chipsStyle, rise[2]]}>
        {suggestions.map((s) => (
          <li key={s.label}>
            <SuggestionChip href={s.href} mix={chipStyle}>
              {s.label}
            </SuggestionChip>
          </li>
        ))}
      </ul>

      <p mix={[monoNote, noteStyle, rise[3]]}>
        {/* The signed-in line fits one phone line, so it stays plain text. */}
        {handle.props.signedIn ? (
          'Signed in · your progress saves as you go'
        ) : (
          <>
            Free to start<span mix={dotBreak}> · </span>no account needed
            <span mix={dotBreak}> · </span>sign in to save progress
          </>
        )}
      </p>

      <div mix={[cueStyle, rise[4]]}>
        <div aria-hidden="true" mix={cueTextStyle}>
          Scroll · the network rewires itself
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
const rise = [0, 1, 2, 3, 4].map((i) =>
  css({
    animation: `bits-rise var(--duration-pop) var(--ease-out) ${i * 70}ms both`,
    [REDUCED]: { animation: 'none' },
  }),
)

const heroStyle = css({
  // One full fold (decision 048): the scroll cue and pause control sit on
  // its bottom edge (they take `margin-top: auto`). Phones size to content.
  padding: 'var(--space-20) var(--section-pad-x) var(--space-8)',
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

/*
 * The prompt bar (components §7.4; decisions 040 and 047).
 *
 * One row, everything centred on it, squared. The Ask key's underline is
 * drawn inside the key, so its box is what you see and the insets around
 * it are equal: 8px on desktop, 6px on phones. The chevron uses the input's
 * font, size and line box, so its glyph sits on the text's line. The ground
 * is flat ink (`--cell-fill`, no blur) with a hairline that turns volt and
 * doubles on focus.
 */
const barStyle = css({
  width: '100%',
  maxWidth: 'var(--read-width)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-5)',
  boxSizing: 'border-box',
  background: 'var(--cell-fill)',
  border: 'var(--border-w) solid var(--line-drop)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:hover': { borderColor: 'var(--line-node-next)' },
  '&:focus-within': {
    borderColor: 'var(--focus-border)',
    boxShadow: 'var(--focus-ring-soft)',
  },
  [FORCED]: {
    background: 'Canvas',
    borderColor: 'CanvasText',
    '&:focus-within': { outline: '2px solid Highlight', outlineOffset: '2px' },
  },
  [PHONE]: {
    gap: 'var(--space-2_5)',
    padding: 'var(--space-1_5) var(--space-1_5) var(--space-1_5) var(--space-4)',
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
  background: 'var(--volt)',
  color: 'var(--on-volt)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  // The flat key (decision 047): a 2px underline inside the box.
  boxShadow: 'var(--shadow-keycap-volt)',
  transition:
    'background-color var(--duration-press) var(--ease), box-shadow var(--duration-press) var(--ease), transform var(--duration-press) var(--ease)',
  '&:hover': { background: 'var(--volt-hover)' },
  '&:active': { transform: 'translateY(var(--keycap-travel))', boxShadow: 'var(--shadow-keycap-volt-pressed)' },
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset)' },
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
  background: 'var(--on-volt-a12)',
  fontSize: 'var(--fs-12)',
})

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
  paddingTop: 'var(--space-10)',
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
  color: 'var(--dim)',
})

const cueLine = css({
  display: 'block',
  width: 'var(--border-w)',
  height: 'var(--space-12)',
  background: 'var(--volt)',
  animation: 'bits-cue 2.4s ease-in-out infinite',
  [REDUCED]: { animation: 'none' },
  [FORCED]: { forcedColorAdjust: 'none', background: 'CanvasText' },
  [PHONE]: { height: 'var(--space-8)' },
})
