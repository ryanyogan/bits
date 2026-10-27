import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { Icon } from './icon.tsx'
import { FORCED_COLORS, forcedFill } from './lib/states.ts'

export type LessonState = 'done' | 'current' | 'next'
export type LessonNodeSize = 32 | 30 | 20

export interface LessonNodeProps {
  state: LessonState
  /** 32 (System), 30 (Course syllabus, in a 40px slot), 20 (Lesson outline). Resolutions §4. */
  size?: LessonNodeSize
  /** Numeral shown in the 20px outline node (current / next). */
  n?: number
  /** Current lesson already passed: the 20px node shows volt + ✓. */
  passed?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * The lesson state dot (components §10.1). Decorative (`aria-hidden`): the
 * row's text carries the state. The current node pulses (off under reduced
 * motion). Static.
 */
export function LessonNode(handle: Handle<LessonNodeProps>) {
  return () => {
    let { state, size = 32, n, passed, mix } = handle.props
    let mini = size === 20
    let shown: LessonState = mini && state === 'current' && passed ? 'done' : state
    return (
      <span
        aria-hidden="true"
        data-state={shown}
        mix={[nodeStyle, sizeStyles[size], shown === 'current' && !mini ? pulseStyle : undefined, mix]}
      >
        {shown === 'done' ? (
          mini ? (
            '✓'
          ) : (
            <Icon name="check" size={size === 30 ? 13 : 14} color="currentColor" />
          )
        ) : shown === 'current' && !mini ? (
          <span mix={dotStyle} />
        ) : mini && n !== undefined ? (
          String(n)
        ) : null}
      </span>
    )
  }
}

const nodeStyle = css({
  flex: 'none',
  boxSizing: 'border-box',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 'var(--radius-pill)',
  '&[data-state="done"]': { background: 'var(--volt)', color: 'var(--on-volt)' },
  '&[data-state="current"]': { border: 'var(--border-w-strong) solid var(--ion)' },
  '&[data-state="next"]': { border: 'var(--border-w) dashed var(--line-node-next)' },
  // Forced colours: done is a filled disc (it was only a background), current a ring, next a dashed ring.
  [FORCED_COLORS]: { '&[data-state="done"]': { forcedColorAdjust: 'none', background: 'CanvasText', color: 'Canvas' } },
})

const sizeStyles: Record<LessonNodeSize, ReturnType<typeof css>> = {
  32: css({ width: '32px', height: '32px' }),
  30: css({
    width: '30px',
    height: '30px',
    '&[data-state="current"], &[data-state="next"]': { background: 'var(--ink)' },
  }),
  // Resolutions §4: the outline numerals must be readable.
  20: css({
    width: '20px',
    height: '20px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-10)',
    lineHeight: 1,
    '&[data-state="current"]': { color: 'var(--ion)' },
    '&[data-state="next"]': { background: 'var(--raised)', color: 'var(--muted)' },
  }),
}

const dotStyle = css({
  width: '10px',
  height: '10px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--ion)',
  [FORCED_COLORS]: forcedFill,
})
// The System `.pulse`: an ion ring breathing out to 8px from the node itself.
const pulseStyle = css({
  animation: 'bits-pulse-ion var(--duration-pulse) ease-in-out infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

const stateText: Record<LessonState, string> = {
  done: '— completed',
  current: '— in progress',
  next: '— not started',
}

export interface LessonNodeRowProps {
  state: LessonState
  children?: RemixNode
  /** Right-aligned label on the current row ("IN PROGRESS"). */
  badge?: string
  mix?: MixInput<HTMLElement>
}

/** The System artboard's node + label row (as an `<li>`). Static. */
export function LessonNodeRow(handle: Handle<LessonNodeRowProps>) {
  return () => {
    let { state, children, badge = 'IN PROGRESS', mix } = handle.props
    return (
      <li aria-current={state === 'current' ? 'step' : undefined} mix={[rowStyle, mix]}>
        <LessonNode state={state} />
        <span data-state={state} mix={labelStyle}>
          {children}
          <span class="sr-only"> {stateText[state]}</span>
        </span>
        {state === 'current' ? (
          <span aria-hidden="true" mix={badgeStyle}>
            {badge}
          </span>
        ) : null}
      </li>
    )
  }
}

/** Wrap LessonNodeRows in this `<ol>`. */
export const lessonListStyle = css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' })

const rowStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-3_5)', padding: 'var(--space-2_5) 0' })
const labelStyle = css({
  flex: 1,
  minWidth: 0,
  fontSize: 'var(--fs-15)',
  '&[data-state="done"]': {
    color: 'var(--muted)',
    textDecoration: 'line-through',
    textDecorationColor: 'var(--strike-muted)',
  },
  '&[data-state="current"]': { color: 'var(--text)', fontWeight: 600 },
  '&[data-state="next"]': { color: 'var(--text-body)' },
})
const badgeStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--ion)', whiteSpace: 'nowrap' })
