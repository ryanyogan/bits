import type { Handle } from 'remix/component'
import { css } from 'remix/component'

const FORCED_COLORS = '@media (forced-colors: active)'

export interface CatalogBackgroundProps {
  /** Changing it replays the drop (a new track is a new hole to fall into). */
  replayKey: string
}

/**
 * The catalog's background (decision 041): a rabbit hole for "Pick your next
 * rabbit hole." Rings in the three track colours drop into a tilted funnel
 * behind the title, one after another, and a few neurons spiral down after
 * them, over a dot grid that fades out before the course grid. Then it
 * rests: the whole sequence is over in under 5 seconds (WCAG 2.2.2, so no
 * pause control is needed), and picking a track plays it again.
 *
 * Pure CSS, server-rendered, no JS: every animated property is `transform`
 * or `opacity`, so the compositor runs it. Decorative only (`aria-hidden`,
 * no pointer events). Reduced motion shows the resting frame; forced
 * colours hide the layer.
 */
export function CatalogBackground(handle: Handle<CatalogBackgroundProps>) {
  return () => (
    <div aria-hidden="true" data-rmx-key={handle.props.replayKey} mix={layerStyle}>
      <div mix={gridStyle} />
      <div mix={holeStyle}>
        <div mix={coreStyle} />
        {RINGS.map((i) => (
          <span key={`r${i}`} mix={ringStyle} style={{ '--i': i }} />
        ))}
        {MOTES.map(([i, angle], n) => (
          <i key={`m${n}`} mix={moteStyle} style={{ '--i': i, '--a': `${angle}deg` }} />
        ))}
      </div>
    </div>
  )
}

const RINGS = Array.from({ length: 8 }, (_, i) => i)
// [stagger step, start angle]: a handful, so they read as signals, not noise.
const MOTES: [number, number][] = [
  [0, 200],
  [1, 330],
  [2, 80],
  [3, 140],
  [4, 20],
]

// Timings, in seconds. The last mote lands at 1.0 + 4 × 0.32 + 2.6 = 4.88.
const RING_DROP = 2.4
const RING_STAGGER = 0.13
const MOTE_START = 1
const MOTE_STAGGER = 0.32
const MOTE_SPIRAL = 2.6

const STILL = '@media (prefers-reduced-motion: reduce)'

const layerStyle = css({
  position: 'absolute',
  insetInline: 0,
  top: 0,
  height: 'min(760px, 100%)',
  zIndex: -1,
  overflow: 'clip',
  pointerEvents: 'none',
  userSelect: 'none',
  // Fades out above the course grid, so cards always sit on plain ink.
  maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
  [FORCED_COLORS]: { display: 'none' },
})

const gridStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(var(--dot-grid-field) 1px, transparent 1.5px)',
  backgroundSize: 'var(--space-6) var(--space-6)',
  // The grid only shows around the hole.
  maskImage: 'radial-gradient(ellipse 60% 70% at 74% 30%, black, transparent 70%)',
  '@media (max-width: 760px)': {
    maskImage: 'radial-gradient(ellipse 90% 60% at 80% 18%, black, transparent 75%)',
  },
})

/**
 * The funnel: a wide box whose rings shrink toward a point above its centre,
 * so it reads as looking down into a hole at an angle.
 */
const holeStyle = css({
  '--rim': 'min(980px, 120vw)',
  position: 'absolute',
  width: 'var(--rim)',
  height: 'calc(var(--rim) * 0.42)',
  left: '74%',
  top: '30%',
  translate: '-50% -50%',
  '@media (max-width: 760px)': {
    '--rim': '150vw',
    left: '80%',
    top: '150px',
  },
})

/** The glow at the bottom of the hole: it brightens as the rings land. */
const coreStyle = css({
  position: 'absolute',
  left: '50%',
  top: '20%',
  width: '22%',
  aspectRatio: '1.6',
  translate: '-50% -50%',
  borderRadius: '50%',
  background: 'radial-gradient(closest-side, var(--syn-a25), var(--ion-a06) 55%, transparent)',
  opacity: 0.85,
  animation: `catalog-bg-glow ${RING_DROP + 7 * RING_STAGGER}s ease-out both`,
  '@keyframes catalog-bg-glow': {
    from: { opacity: 0, transform: 'scale(0.4)' },
    '70%': { opacity: 1, transform: 'scale(1.12)' },
    to: { opacity: 0.85, transform: 'scale(1)' },
  },
  [STILL]: { animation: 'none' },
})

/**
 * Ring `--i` rests at depth `--i`: smaller and fainter the deeper it is.
 * It drops in from above the rim, outermost first.
 */
const ringStyle = css({
  '--s': 'calc(1 / (1 + var(--i) * 0.55))',
  '--o': 'calc(0.9 - var(--i) * 0.08)',
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  border: '1px solid var(--ring)',
  boxShadow: '0 0 28px var(--ring-glow), inset 0 0 28px var(--ring-glow)',
  // The rim is the box's outline; the bottom of the hole is up at 20%.
  transformOrigin: '50% 20%',
  transform: 'scale(var(--s))',
  opacity: 'var(--o)',
  '--ring': 'var(--volt-a30)',
  '--ring-glow': 'var(--volt-a06)',
  '&:nth-of-type(3n + 2)': { '--ring': 'var(--ion-a35)', '--ring-glow': 'var(--ion-a06)' },
  '&:nth-of-type(3n + 3)': { '--ring': 'var(--syn-a50)', '--ring-glow': 'var(--syn-a14)' },
  animation: `catalog-bg-drop ${RING_DROP}s var(--ease-out) both`,
  animationDelay: `calc(var(--i) * ${RING_STAGGER}s)`,
  '@keyframes catalog-bg-drop': {
    from: { transform: 'scale(calc(var(--s) * 1.8))', opacity: 0 },
    '35%': { opacity: 'var(--o)' },
    to: { transform: 'scale(var(--s))', opacity: 'var(--o)' },
  },
  [STILL]: { animation: 'none' },
})

/**
 * A neuron spiralling down the hole once: one transform list (squash to the
 * rings' ellipse, turn, reach out, size), interpolated part by part, so a
 * single element orbits inward on the compositor.
 */
const moteStyle = css({
  position: 'absolute',
  left: '50%',
  top: '20%',
  width: 'var(--space-1_5)',
  height: 'var(--space-1_5)',
  margin: 'calc(var(--space-1_5) / -2)',
  borderRadius: '50%',
  background: 'var(--volt)',
  boxShadow: '0 0 10px var(--volt-a60)',
  '&:nth-of-type(3n + 2)': { background: 'var(--ion)', boxShadow: '0 0 10px var(--ion-a60)' },
  '&:nth-of-type(3n + 3)': { background: 'var(--synapse)', boxShadow: '0 0 10px var(--syn-a60)' },
  opacity: 0,
  animation: `catalog-bg-spiral ${MOTE_SPIRAL}s cubic-bezier(0.45, 0, 0.6, 1) both`,
  animationDelay: `calc(${MOTE_START}s + var(--i) * ${MOTE_STAGGER}s)`,
  '@keyframes catalog-bg-spiral': {
    from: { transform: 'scaleY(0.42) rotate(var(--a)) translateX(calc(var(--rim) * 0.5)) scale(1.4)', opacity: 0 },
    '12%': { opacity: 1 },
    '80%': { opacity: 0.8 },
    to: { transform: 'scaleY(0.42) rotate(calc(var(--a) + 420deg)) translateX(0px) scale(0.2)', opacity: 0 },
  },
  [STILL]: { display: 'none' },
})
