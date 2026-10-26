import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'

export interface TutorAvatarProps {
  /** 32 (Lesson), 30 (Main preview), 26 (Authoring preview, no icon). */
  size?: 32 | 30 | 26
  mix?: MixInput<HTMLElement>
}

/** The volt tutor tile (components §10.5). Decorative. Static. */
export function TutorAvatar(handle: Handle<TutorAvatarProps>) {
  return () => {
    let { size = 32, mix } = handle.props
    return (
      <span aria-hidden="true" mix={[avatarStyle, avatarSizes[size], mix]}>
        {size === 26 ? null : <Icon name="tutor" size={18} color="var(--on-volt)" />}
      </span>
    )
  }
}

const avatarStyle = css({ flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--volt)' })
const avatarSizes = {
  32: css({ width: '32px', height: '32px', borderRadius: 'var(--radius-10)', '@media (max-width: 480px)': { width: '28px', height: '28px' } }),
  30: css({ width: '30px', height: '30px', borderRadius: 'var(--radius-9)' }),
  26: css({ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)' }),
}

export interface TutorMessageProps {
  /** `lesson` 17/1.7 (default) or `preview` 16/1.6 (Main). */
  variant?: 'lesson' | 'preview'
  mix?: MixInput<HTMLElement>
  /** Paragraphs (`<p>`), `<strong>`, `<code>`. */
  children?: RemixNode
}

/**
 * A tutor turn (components §10.6): avatar + server-rendered lesson text, so
 * it reads with JS off. Static.
 */
export function TutorMessage(handle: Handle<TutorMessageProps>) {
  return () => {
    let { variant = 'lesson', mix, children } = handle.props
    return (
      <article mix={[messageStyle, mix]}>
        <TutorAvatar size={variant === 'preview' ? 30 : 32} />
        <div mix={[contentStyle, variant === 'preview' ? previewContent : lessonContent]}>
          <span class="sr-only">Tutor:</span>
          {children}
        </div>
      </article>
    )
  }
}

const messageStyle = css({
  display: 'flex',
  gap: 'var(--space-3_5)',
  alignItems: 'flex-start',
  '@media (max-width: 480px)': { gap: 'var(--space-2_5)' },
})
const contentStyle = css({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3_5)',
  color: 'var(--text-body)',
  '& p': { margin: 0 },
  '& > p:first-of-type': { marginTop: '3px' },
  '& strong': { color: 'var(--text)' },
  '& code': { fontFamily: 'var(--font-mono)', color: 'var(--ion)', fontSize: '0.94em' },
})
const lessonContent = css({ fontSize: 'var(--fs-17)', lineHeight: 1.7 })
const previewContent = css({ fontSize: 'var(--fs-16)', lineHeight: 1.6 })

/** Indent for blocks attached to a tutor turn (avatar 32 + gap 14); 0 at ≤480px. */
export const attachedBlock = css({ marginLeft: '46px', '@media (max-width: 480px)': { marginLeft: 0 } })

export interface LearnerBubbleProps {
  /** `prompt` (Lesson runs, mono 14, pre-wrap) or `plain` (Main, Geist 16). */
  variant?: 'prompt' | 'plain'
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** The learner's turn, right-aligned (components §10.7). Static. */
export function LearnerBubble(handle: Handle<LearnerBubbleProps>) {
  return () => {
    let { variant = 'prompt', mix, children } = handle.props
    return (
      <div mix={[bubbleStyle, variant === 'prompt' ? promptBubble : plainBubble, mix]}>
        <span class="sr-only">You: </span>
        {children}
      </div>
    )
  }
}

const bubbleStyle = css({
  alignSelf: 'flex-end',
  maxWidth: '82%',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: '16px 16px 4px 16px',
  background: 'var(--bubble)',
  color: 'var(--text)',
  overflowWrap: 'anywhere',
  '@media (max-width: 480px)': { maxWidth: '90%' },
})
const promptBubble = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', lineHeight: 1.55, whiteSpace: 'pre-wrap' })
const plainBubble = css({ maxWidth: '80%', fontSize: 'var(--fs-16)' })

export interface ModelOutputProps {
  temperature: string
  tokens?: number
  /** `done` (default), `streaming` (caret, aria-busy), `example` (fallback label), `error` (warn note). */
  state?: 'done' | 'streaming' | 'example' | 'error'
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** A model reply under a run (components §10.8). Static shell; the composer island renders it. */
export function ModelOutput(handle: Handle<ModelOutputProps>) {
  return () => {
    let { temperature, tokens, state = 'done', mix, children } = handle.props
    let meta =
      state === 'streaming'
        ? `model · T=${temperature} · streaming…`
        : state === 'example' || state === 'error'
          ? `example output · T=${temperature}`
          : `model · T=${temperature} · ${tokens ?? 0} tokens`
    return (
      <div aria-busy={state === 'streaming' ? 'true' : undefined} mix={[outputStyle, attachedBlock, mix]}>
        {state === 'error' ? <p mix={errorStyle}>Couldn’t reach the model — showing the example output.</p> : null}
        <p mix={metaStyle}>{meta}</p>
        <p mix={textStyle}>
          {children}
          {state === 'streaming' ? (
            <span aria-hidden="true" mix={caretStyle}>
              ▍
            </span>
          ) : null}
        </p>
      </div>
    )
  }
}

export const modelPanelStyle = css({
  padding: 'var(--space-3_5) var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--ion-a25)',
  background: 'var(--ion-a04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
})
const outputStyle = modelPanelStyle
const metaStyle = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--ion)' })
const textStyle = css({ margin: 0, fontSize: 'var(--fs-18)', lineHeight: 1.5, color: 'var(--text)', overflowWrap: 'anywhere' })
const errorStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--warn)' })
const caretStyle = css({
  color: 'var(--ion)',
  animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
