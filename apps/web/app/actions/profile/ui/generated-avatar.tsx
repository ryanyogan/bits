import type { Handle } from 'remix/component'
import { css } from 'remix/component'

export interface GeneratedAvatarProps {
  /** Stable per user, normally the handle. */
  seed: string
  /** Display name for the accessible label. */
  name: string
}

/** The artboard's six outer vertices (components §1.3), clockwise from top-left. */
const BASE: Array<[number, number]> = [
  [40, 46],
  [74, 30],
  [108, 52],
  [100, 98],
  [64, 112],
  [36, 86],
]
const RADII = [6, 5, 6, 5, 6, 5]
const DOT_COLOURS = ['var(--text)', 'var(--ion)', 'var(--synapse)']
/** The artboard's dot colours for the design fixture (index into DOT_COLOURS). */
const ARTBOARD_DOTS = [0, 1, 0, 2, 0, 1]

function hash(text: string): number {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * Deterministic constellation avatar (components §1.3), in a square frame: a volt hub joined to
 * six outer nodes. Each handle jitters the vertices by up to ±6px and picks
 * the outer dot colours; the design fixture ("jamie") renders exactly as
 * drawn. Server-rendered SVG, 148px, 96px at ≤480px.
 */
export function GeneratedAvatar(handle: Handle<GeneratedAvatarProps>) {
  return () => {
    let { seed, name } = handle.props
    let drawn = seed === 'jamie'
    let h = hash(seed)
    let next = () => {
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
      h = (h ^ (h >>> 12)) >>> 0
      return h
    }
    let points = BASE.map(([x, y]) => (drawn ? [x, y] : [x + (next() % 13) - 6, y + (next() % 13) - 6]) as [number, number])
    let colours = BASE.map((_, i) => DOT_COLOURS[drawn ? ARTBOARD_DOTS[i]! : next() % 3]!)
    let [a, b, c, d, e, f] = points.map(([x, y]) => `${x} ${y}`)
    return (
      <svg
        width="148"
        height="148"
        viewBox="0 0 148 148"
        role="img"
        aria-label={`${name}'s generated avatar`}
        mix={avatarStyle}
      >
        {/* Squared (decision 047): a hairline frame, the volt edge kept as the signal. */}
        <rect x="0.5" y="0.5" width="147" height="147" style={{ fill: 'var(--surface)', stroke: 'var(--volt-a45)' }} />
        {/* fill="none": the artboard's outer path has no fill and renders black (README §E). */}
        <g fill="none" stroke-width="1.4" style={{ stroke: 'var(--avatar-edge)' }}>
          <path d={`M${a} L${b} L${c} L${d} L${e} L${f} Z`} />
          <path d={`M${a} L74 74 L${c} M74 74 L${d} M74 74 L${e} M74 74 L${f} M${b} L74 74`} />
        </g>
        <circle cx="74" cy="74" r="10" style={{ fill: 'var(--volt)' }} />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={RADII[i]} style={{ fill: colours[i] }} />
        ))}
      </svg>
    )
  }
}

const avatarStyle = css({
  flex: 'none',
  display: 'block',
  '@media (max-width: 480px)': { width: '96px', height: '96px' },
})
