import { css, type Handle } from 'remix/component'
import { CellGrid, cellInkStyle, cellVeilStyle } from '@bits/ui/cell-grid'
import { RuledSection } from '@bits/ui/ruled-section'
import { StaticTabs } from '@bits/ui/segmented-tabs'
import { TokenizerPanel } from '@bits/ui/token-pill'
import { LearnerBubble, TutorMessage } from '@bits/ui/tutor'

import { h2Style, introStyle, leadStyle, PHONE } from './styles.ts'

const features = [
  ['Read', 'Chat-style lessons you can skim, explained for newcomers or straight to the point for engineers.'],
  ['Type', "Prompt exercises with live checks — you can't skip ahead by scrolling."],
  ['Run', 'Real code in a real editor. Copy it, change it, break it on purpose.'],
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

/**
 * "How it works" (Main.md §3): the pitch and a picture of a lesson in two
 * cells, then the three verbs (read, type, run) as a row of cells. Copy sits
 * on the veil so the field reads through; the preview card is an object and
 * keeps the ink slab (decision 048).
 */
export function HowItWorks(_handle: Handle) {
  return () => (
    <RuledSection id="how" aria-labelledby="how-title" label="How it works" pad="none" mix={timeline}>
      <CellGrid cols={2} pad={false} top={false}>
        <div mix={[cellVeilStyle, copyCell]}>
          <div mix={introStyle}>
            <h2 id="how-title" mix={h2Style}>
              Every lesson is a conversation.
            </h2>
            <p mix={leadStyle}>
              No 40-minute lectures. A tutor explains one idea, then hands you the keyboard. You type
              the prompt, the model answers, and the lesson checks what you actually did.
            </p>
          </div>
        </div>
        <div mix={[cellInkStyle, previewCell]}>
          <LessonPreview />
        </div>
      </CellGrid>
      <CellGrid as="ul" cols={3} fill="veil" aria-label="What you do in a lesson">
        {features.map(([key, text]) => (
          <li key={key} mix={featureCell}>
            <span mix={featureKey}>{key}</span>
            <span mix={featureText}>{text}</span>
          </li>
        ))}
      </CellGrid>
    </RuledSection>
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
          <StaticTabs items={['New to this', 'Engineer']} selected={0} size="sm" />
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

// Names the view timeline the header's "How it works" link follows (decision 040).
const timeline = css({ viewTimelineName: '--how' })

const copyCell = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: 'var(--section-pad-y) var(--cell-pad-lg)',
  [PHONE]: { padding: 'var(--space-12) var(--section-pad-x)' },
})
const previewCell = css({ padding: 'var(--cell-pad-lg)' })

const featureCell = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' })
const featureKey = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--volt)',
})
const featureText = css({ fontSize: 'var(--fs-16)', lineHeight: 1.5, color: 'var(--text-body)' })

const figureStyle = css({ margin: 0, minWidth: 0 })
const cardStyle = css({
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-panel)',
  overflow: 'hidden',
  userSelect: 'none',
})
const cardHeader = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line)',
  flexWrap: 'wrap',
})
const cardContext = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const cardBody = css({
  padding: 'var(--space-6)',
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
  border: 'var(--border-w) solid var(--line-control)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-15)',
})
const cardFooter = css({ padding: 'var(--space-3)', borderTop: 'var(--border-w) solid var(--line)' })
const composer = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-3_5)',
  background: 'var(--well)',
  border: 'var(--border-w) solid var(--volt-a35)',
})
const yourTurn = css({
  flex: 'none',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--on-volt)',
  background: 'var(--volt)',
  padding: 'var(--space-0_75) var(--space-2)',
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
