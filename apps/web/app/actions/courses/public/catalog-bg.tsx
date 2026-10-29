import type { Handle } from 'remix/component'
import { css } from 'remix/component'

const FORCED_COLORS = '@media (forced-colors: active)'

export interface CatalogBackgroundProps {
  /** Changing it replays the drop (a new track is a new hole to fall into). */
  replayKey: string
}

/**
 * The catalog's background (decision 041, squared in 047): a rabbit hole for
 * "Pick your next rabbit hole." Square frames in the three track colours
 * drop into a tunnel behind the title, one after another, and a few square
 * neurons spiral down after them, over the landing's graph paper, which
 * fades out before the course grid. Hairlines only: no glows, no blobs.
 * Then it rests: the whole sequence is over in under 5 seconds (WCAG 2.2.2,
 * so no pause control is needed), and picking a track plays it again.
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
      {/* The art stays inside the ruled column: the graph paper runs full
       * bleed, the shaft (and its drop) is clipped at the rails. */}
      <div mix={columnStyle}>
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
  // The landing field's graph paper (decision 047), so the two pages match.
  backgroundImage:
    'linear-gradient(var(--field-grid) 1px, transparent 1px), linear-gradient(90deg, var(--field-grid) 1px, transparent 1px)',
  backgroundSize: 'var(--field-grid-step) var(--field-grid-step)',
  backgroundPosition: 'center top',
  // The grid only shows around the hole.
  maskImage: 'radial-gradient(ellipse 60% 70% at 74% 30%, black, transparent 70%)',
  '@media (max-width: 760px)': {
    maskImage: 'radial-gradient(ellipse 90% 60% at 80% 18%, black, transparent 75%)',
  },
})

/** The PageFrame's column (rails included), as an absolute box over the full-bleed layer. */
const columnStyle = css({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetInline: 'max(var(--frame-inset), calc((100% - var(--frame-max)) / 2))',
  overflow: 'clip',
})

/**
 * The tunnel: a wide box whose frames shrink toward a point above its
 * centre, so it reads as looking down a square shaft at an angle.
 */
const holeStyle = css({
  // Scales with the screen above 760px, as the title band does, so the rim
  // never outgrows the band (640 at 1440, 450 at 1024).
  '--rim': 'min(640px, 44vw)',
  position: 'absolute',
  width: 'var(--rim)',
  height: 'calc(var(--rim) * 0.42)',
  // Of the column: where 72% of the full width put it at 1440, and the rim's
  // right edge stays inside the right rail down to 760px.
  left: '74%',
  // High enough that the rim's bottom edge stays inside the title band: the
  // ground shows under that band now (decision 050), so nothing hides it.
  top: '21%',
  translate: '-50% -50%',
  '@media (max-width: 760px)': {
    '--rim': '110vw',
    left: '91%',
    top: '84px',
    // Under the title on a phone: quieter, so the frames never fight the text.
    opacity: 0.6,
  },
})

/**
 * The floor of the shaft, a flat synapse tint the shape of the deepest
 * frame: it fades in as the frames land.
 */
const coreStyle = css({
  position: 'absolute',
  // Centred in the deepest frame (scale 1 / 4.85 about 50% 20%).
  left: '50%',
  top: '26%',
  width: '16%',
  height: '16%',
  translate: '-50% -50%',
  background: 'var(--ion-a06)',
  border: '1px solid var(--syn-a50)',
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
 * Frame `--i` rests at depth `--i`: smaller and fainter the deeper it is.
 * It drops in from above the rim, outermost first.
 */
const ringStyle = css({
  '--s': 'calc(1 / (1 + var(--i) * 0.55))',
  '--o': 'calc(0.9 - var(--i) * 0.08)',
  position: 'absolute',
  inset: 0,
  border: '1px solid var(--ring)',
  // The rim is the box's outline; the bottom of the hole is up at 20%.
  transformOrigin: '50% 20%',
  transform: 'scale(var(--s))',
  opacity: 'var(--o)',
  '--ring': 'var(--volt-a30)',
  '&:nth-of-type(3n + 2)': { '--ring': 'var(--ion-a35)' },
  '&:nth-of-type(3n + 3)': { '--ring': 'var(--syn-a50)' },
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
 * A square neuron spiralling down the hole once: one transform list (squash to the
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
  background: 'var(--volt)',
  '&:nth-of-type(3n + 2)': { background: 'var(--ion)' },
  '&:nth-of-type(3n + 3)': { background: 'var(--synapse)' },
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
