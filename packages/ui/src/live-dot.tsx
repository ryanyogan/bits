import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

export interface LiveDotProps {
  /** `volt` (connected, live), `ion` (building), `dim` (not connected). */
  tone?: 'volt' | 'ion' | 'dim'
  /** Pulse the dot (respects reduced motion). */
  pulse?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Inline mono status: "● connected" (components §8.8). The dot is decorative. Static. */
export function LiveDot(handle: Handle<LiveDotProps>) {
  return () => {
    let { tone = 'volt', pulse, mix, children } = handle.props
    return (
      <span mix={[dotStyle, toneStyles[tone], mix]}>
        <span aria-hidden="true" mix={pulse ? pulseStyle : undefined}>
          ●
        </span>
        <span>{children}</span>
      </span>
    )
  }
}

const dotStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
})
const toneStyles = {
  volt: css({ color: 'var(--volt)' }),
  ion: css({ color: 'var(--ion)' }),
  dim: css({ color: 'var(--dim)' }),
}
const pulseStyle = css({
  animation: 'bits-blink var(--duration-pulse) ease-in-out infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
