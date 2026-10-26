import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

export interface ProgressRingProps {
  /** 0–100. */
  pct: number
  /** 96 (Course aside, stroke 8) or 132 (Main showcase, stroke 10). */
  size?: 96 | 132
  /** Ring colour; defaults to ion in progress, volt at 100%. */
  color?: string
  /** Mono caption under the number (132 only), e.g. "CONTEXT". */
  caption?: string
  /** Accessible name; defaults to "{pct} percent complete". */
  label?: string
  mix?: MixInput<SVGSVGElement>
}

/** SVG ring (components §9.7). `pct = 0` omits the fill circle (a round cap would draw a dot). Static. */
export function ProgressRing(handle: Handle<ProgressRingProps>) {
  return () => {
    let { pct, size = 96, caption, label, mix } = handle.props
    let value = Math.max(0, Math.min(100, Math.round(pct)))
    let big = size === 132
    let half = size / 2
    let r = big ? 56 : 40
    let stroke = big ? 10 : 8
    let circumference = 2 * Math.PI * r
    let color = handle.props.color ?? (value >= 100 ? 'var(--volt)' : 'var(--ion)')
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? `${value} percent complete`}
        mix={[ringStyle, mix]}
      >
        <circle cx={half} cy={half} r={r} stroke-width={stroke} fill="none" style={{ stroke: 'var(--fill-btn)' }} />
        {value > 0 ? (
          <circle
            cx={half}
            cy={half}
            r={r}
            style={{ stroke: color }}
            stroke-width={stroke}
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={`${((circumference * value) / 100).toFixed(1)} ${circumference.toFixed(1)}`}
            transform={`rotate(-90 ${half} ${half})`}
          />
        ) : null}
        <text
          x={half}
          y={big ? 66 : 54}
          text-anchor="middle"
          mix={[valueText, big ? valueBig : valueSmall]}
        >
          {`${value}%`}
        </text>
        {big && caption ? (
          <text x={half} y={88} text-anchor="middle" mix={captionText}>
            {caption}
          </text>
        ) : null}
      </svg>
    )
  }
}

const ringStyle = css({ flex: 'none', display: 'block' })
const valueText = css({ fontFamily: 'var(--font-display)', fontWeight: 700, fill: 'var(--text)' })
const valueBig = css({ fontSize: '28px' })
const valueSmall = css({ fontSize: '20px' })
const captionText = css({ fontFamily: 'var(--font-mono)', fontSize: '10px', fill: 'var(--muted)' })
