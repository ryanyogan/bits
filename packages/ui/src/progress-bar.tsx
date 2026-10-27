import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS, forcedInlineFill, forcedTrack } from './lib/states.ts'

export type ProgressBarVariant = 'card' | 'banner' | 'art' | 'row' | 'level'

export interface ProgressBarProps {
  /** 0–100. */
  pct: number
  variant?: ProgressBarVariant
  /** Fill colour, e.g. `var(--ion)`. Defaults to volt. */
  color?: string
  /**
   * Accessible name. When set the bar is a `progressbar`; when omitted it is
   * `aria-hidden` and the caller renders the percentage as adjacent text.
   */
  label?: string
  mix?: MixInput<HTMLElement>
}

/** Track + fill (components §9.5). Static. */
export function ProgressBar(handle: Handle<ProgressBarProps>) {
  return () => {
    let { pct, variant = 'card', color = 'var(--volt)', label, mix } = handle.props
    let value = Math.max(0, Math.min(100, Math.round(pct)))
    return (
      <div
        role={label ? 'progressbar' : undefined}
        aria-label={label}
        aria-valuenow={label ? value : undefined}
        aria-valuemin={label ? 0 : undefined}
        aria-valuemax={label ? 100 : undefined}
        aria-hidden={label ? undefined : 'true'}
        mix={[trackStyle, trackVariants[variant], mix]}
      >
        <span mix={[fillStyle, fillVariants[variant]]} style={{ width: `${value}%`, background: color }} />
      </div>
    )
  }
}

const trackStyle = css({ display: 'block', background: 'var(--fill-btn)', overflow: 'hidden', minWidth: 0, [FORCED_COLORS]: forcedTrack })
const trackVariants: Record<ProgressBarVariant, ReturnType<typeof css>> = {
  card: css({ flex: 1, height: '4px', borderRadius: 'var(--radius-2)' }),
  banner: css({ flex: 1, minWidth: '160px', height: '6px', borderRadius: 'var(--radius-3)' }),
  art: css({ flex: 1, height: '6px', borderRadius: 'var(--radius-3)' }),
  row: css({ flex: 1, height: '5px', borderRadius: 'var(--radius-3)' }),
  level: css({ width: '100%', maxWidth: '420px', height: '8px', borderRadius: 'var(--radius-4)' }),
}
const fillStyle = css({ display: 'block', height: '100%', [FORCED_COLORS]: forcedInlineFill })
const fillVariants: Record<ProgressBarVariant, ReturnType<typeof css>> = {
  card: css({}),
  banner: css({ borderRadius: 'var(--radius-3)' }),
  art: css({}),
  row: css({}),
  level: css({}),
}

export type SegmentState = 'done' | 'current' | 'passed' | 'upcoming'

export interface SegmentedProgressProps {
  segments: SegmentState[]
  /** e.g. "Lesson 6 of 8, 5 complete". */
  label: string
  mix?: MixInput<HTMLElement>
}

/** One segment per lesson in the lesson bar (components §9.6). Static. */
export function SegmentedProgress(handle: Handle<SegmentedProgressProps>) {
  return () => {
    let { segments, label, mix } = handle.props
    return (
      <div role="img" aria-label={label} mix={[segmentsStyle, mix]}>
        {segments.map((state, index) => (
          <span key={index} data-state={state} mix={segmentStyle} />
        ))}
      </div>
    )
  }
}

const segmentsStyle = css({ display: 'flex', gap: 'var(--space-1)', minWidth: 0 })
const segmentStyle = css({
  flex: 1,
  height: '5px',
  borderRadius: 'var(--radius-3)',
  background: 'var(--fill-seg-off)',
  '&[data-state="done"], &[data-state="passed"]': { background: 'var(--volt)' },
  '&[data-state="current"]': { background: 'linear-gradient(90deg, var(--ion) 50%, var(--fill-seg-off) 50%)' },
  // Forced colours: framed segments, done ones filled, the current one half filled.
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    background: 'Canvas',
    outline: 'var(--border-w) solid CanvasText',
    outlineOffset: '-1px',
    '&[data-state="done"], &[data-state="passed"]': { background: 'CanvasText' },
    '&[data-state="current"]': { background: 'linear-gradient(90deg, CanvasText 50%, Canvas 50%)' },
  },
})
