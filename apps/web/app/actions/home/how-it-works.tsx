import { css, type Handle } from 'remix/component'
import { Eyebrow } from '@bits/ui/eyebrow'
import { StaticTabs } from '@bits/ui/segmented-tabs'
import { TokenizerPanel } from '@bits/ui/token-pill'
import { LearnerBubble, TutorMessage } from '@bits/ui/tutor'

import { h2Style, leadStyle, PHONE, sectionStyle, splitGrid } from './styles.ts'

const features = [
  ['READ', "Chat-style lessons you can skim, or switch to terminal mode if that's more your speed."],
  ['TYPE', "Prompt exercises with live checks — you can't skip ahead by scrolling."],
  ['RUN', 'Real code in a real editor. Copy it, change it, break it on purpose.'],
] as const

const sampleTokens: [string, string][] = [
  ['Un', '1844'],
  ['believ', '31141'],
  ['ably', '2915'],
  [',', '11'],
  [' the', '279'],
  [' cat', '8415'],
  [' fetched', '42118'],
  ['.', '13'],
]

/** "02 — How it works" (Main.md §3): FeatureRows + a picture of a lesson. */
export function HowItWorks(_handle: Handle) {
  return () => (
    <section id="how" aria-labelledby="how-title" mix={sectionStyle}>
      <div mix={splitGrid('500px')}>
        <div mix={columnStyle}>
          <Eyebrow tone="ion" as="p">
            02 — How it works
          </Eyebrow>
          <h2 id="how-title" mix={h2Style}>
            Every lesson is a conversation.
          </h2>
          <p mix={[leadStyle, leadWidth]}>
            No 40-minute lectures. A tutor explains one idea, then hands you the keyboard. You type
            the prompt, the model answers, and the lesson checks what you actually did.
          </p>
          <dl mix={featureList}>
            {features.map(([key, text]) => (
              <div key={key} mix={featureRow}>
                <dt mix={featureKey}>{key}</dt>
                <dd mix={featureText}>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <LessonPreview />
      </div>
    </section>
  )
}

/**
 * LessonPreviewCard (components §12.4). A picture of a lesson: the card is
 * `inert` so its fake controls are never focusable, and a visually hidden
 * caption describes it instead.
 */
function LessonPreview(_handle: Handle) {
  return () => (
    <figure mix={figureStyle}>
      <figcaption class="sr-only">
        Example lesson: the tutor splits “Unbelievably, the cat fetched.” into 8 tokens, then asks
        whether “ cat” with its leading space is the same token as “cat”.
      </figcaption>
      <div inert aria-hidden="true" mix={cardStyle}>
        <div mix={cardHeader}>
          <span mix={cardContext}>Lesson 2 · Tokens, not words</span>
          <StaticTabs items={['Read', 'Watch', 'Terminal']} selected={0} size="sm" />
        </div>
        <div mix={cardBody}>
          <TutorMessage variant="preview">
            <p>
              Models don't read words — they read <strong>tokens</strong>. Type any sentence and
              I'll split it the way the model sees it.
            </p>
          </TutorMessage>
          <LearnerBubble variant="plain">Unbelievably, the cat fetched.</LearnerBubble>
          <TokenizerPanel tokens={sampleTokens} />
          <TutorMessage variant="preview">
            <p>
              See how <code>“ cat”</code> carries its leading space? Quick check — is it the same
              token as <code>“cat”</code>?
            </p>
            <div mix={fakeButtons}>
              <span mix={fakeButton}>Same token</span>
              <span mix={fakeButton}>Different token</span>
            </div>
          </TutorMessage>
        </div>
        <div mix={cardFooter}>
          <div mix={composer}>
            <span mix={yourTurn}>Your turn</span>
            <span mix={composerText}>
              Type a sentence to tokenize<span mix={composerCaret}>▍</span>
            </span>
            <span mix={runHint}>↵ run</span>
          </div>
        </div>
      </div>
    </figure>
  )
}

const columnStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' })
const leadWidth = css({ maxWidth: '520px' })

const featureList = css({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0_5)',
  borderTop: '1px solid var(--line)',
})
const featureRow = css({
  display: 'flex',
  gap: 'var(--space-5)',
  padding: 'var(--space-4_5) 0',
  borderBottom: '1px solid var(--line)',
  alignItems: 'baseline',
})
const featureKey = css({
  width: '56px',
  flex: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--volt)',
})
const featureText = css({ margin: 0, fontSize: 'var(--fs-17)', lineHeight: 1.5, color: 'var(--text-body)' })

const figureStyle = css({ margin: 0, minWidth: 0 })
const cardStyle = css({
  background: 'var(--glass)',
  WebkitBackdropFilter: 'blur(var(--blur-preview))',
  backdropFilter: 'blur(var(--blur-preview))',
  border: '1px solid var(--line-panel)',
  borderRadius: 'var(--radius-2xl)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-float)',
  userSelect: 'none',
})
const cardHeader = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-4) var(--space-5)',
  borderBottom: '1px solid var(--line)',
  flexWrap: 'wrap',
})
const cardContext = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const cardBody = css({
  padding: 'var(--space-6_5) var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  [PHONE]: { padding: 'var(--space-5) var(--space-4)' },
})
const fakeButtons = css({ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' })
const fakeButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  boxSizing: 'border-box',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--line-control)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-15)',
})
const cardFooter = css({ padding: 'var(--space-3_5)', borderTop: '1px solid var(--line)' })
const composer = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--well)',
  border: '1px solid var(--volt-a35)',
})
const yourTurn = css({
  flex: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--on-volt)',
  background: 'var(--volt)',
  padding: '3px var(--space-2)',
  borderRadius: 'var(--radius-xs)',
})
const composerText = css({
  flex: 1,
  minWidth: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-15)',
  color: 'var(--dim)',
})
const composerCaret = css({
  color: 'var(--volt)',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const runHint = css({ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
