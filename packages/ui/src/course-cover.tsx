import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { toneAlpha, toneVars, type Tone } from './lib/tone.ts'

/** The eight named cover patterns (components §9.1), for `course.md` `cover: {pattern, sigil}`. */
export type CoverPattern = 'dots' | 'stripes-115' | 'rules' | 'grid' | 'rings' | 'dots-offset' | 'rays' | 'crosshatch'

export const coverPatterns: CoverPattern[] = [
  'dots',
  'stripes-115',
  'rules',
  'grid',
  'rings',
  'dots-offset',
  'rays',
  'crosshatch',
]

/**
 * A bit of `size` px (a number for a square, `[width, height]` for a dash)
 * in the top-left corner of each `tile` (decision 058): a conic gradient
 * centred on the bit's far corner paints only its top-left quadrant. `at`
 * offsets the tiling so the bits land where a line layer underneath crosses.
 */
function bits(size: number | [number, number], color: string, tile: string, at = '0 0'): string {
  let [w, h] = typeof size === 'number' ? [size, size] : size
  return `conic-gradient(at ${w}px ${h}px, transparent 75%, ${color} 0) ${at} / ${tile}`
}

/**
 * Pattern backgrounds, each on `--well`, all drawn from bits (decision 058):
 * lattices of square cells, rows of bits, nodes on a graph, dashed rings and
 * rays. The eight names are the ones `course.md` uses (components §9.1), so
 * a course keeps its pattern and only its drawing changed. Colours come
 * from `--tone` through `color-mix()`, so one recipe serves volt, ion and
 * synapse. Layers are listed top first; a `--well` layer on top cuts a line
 * layer under it into dashes. `thumb` is the scaled Profile-thumbnail recipe.
 */
const patternBackground: Record<CoverPattern, string> = {
  // A lattice of 2px bits every 14px, with one in nine lit brighter.
  dots: `${bits(3, toneAlpha(80), '42px 42px', '14px 14px')}, ${bits(2, toneAlpha(45), '14px 14px')}, var(--well)`,
  // A bit stream: rows of 2px dashes, two rhythms interleaved.
  'stripes-115': `${bits([6, 2], toneAlpha(38), '10px 18px')}, ${bits([9, 2], toneAlpha(20), '16px 18px', '5px 9px')}, var(--well)`,
  // Ruled lines with a bit on each rule every 54px.
  rules: `${bits(3, toneAlpha(55), '54px 18px', '0 -1px')}, linear-gradient(${toneAlpha(22)} 1px, transparent 1px) 0 0 / 100% 18px, var(--well)`,
  // Graph paper with a node on every other crossing.
  grid: `${bits(3, toneAlpha(60), '44px 44px', '-1px -1px')}, linear-gradient(90deg, ${toneAlpha(28)} 1px, transparent 1px) 0 0 / 22px 100%, linear-gradient(${toneAlpha(28)} 1px, transparent 1px) 0 0 / 100% 22px, var(--well)`,
  // Rings cut into dashes by well-coloured wedges: bits around an origin.
  rings: `repeating-conic-gradient(from 0deg at 85% 110%, transparent 0 5deg, var(--well) 5deg 8deg), repeating-radial-gradient(circle at 85% 110%, transparent 0 14px, ${toneAlpha(42)} 14px 15px), var(--well)`,
  // A faint checkerboard of 18px cells with a bit in every cell's corner.
  'dots-offset': `${bits(3, toneAlpha(55), '18px 18px')}, conic-gradient(${toneAlpha(4)} 25%, transparent 0 50%, ${toneAlpha(4)} 0 75%, transparent 0) 0 0 / 36px 36px, var(--well)`,
  // Rays cut into dashes by well-coloured rings.
  rays: `repeating-radial-gradient(circle at 50% 120%, transparent 0 10px, var(--well) 10px 14px), repeating-conic-gradient(from 0deg at 50% 120%, ${toneAlpha(28)} 0 2deg, transparent 2deg 12deg), var(--well)`,
  // Byte rows: 3px bits every 6px, in groups of eight, every fourth on alternate rows lit brighter.
  crosshatch: `repeating-linear-gradient(90deg, transparent 0 48px, var(--well) 48px 54px), ${bits(3, toneAlpha(65), '24px 28px', '12px 0')}, ${bits(3, toneAlpha(36), '6px 14px')}, var(--well)`,
}

const thumbOverrides: Partial<Record<CoverPattern, string>> = {
  'stripes-115': `${bits([4, 2], toneAlpha(40), '7px 12px')}, ${bits([5, 2], toneAlpha(22), '11px 12px', '3px 6px')}, var(--well)`,
  rays: `repeating-radial-gradient(circle at 50% 120%, transparent 0 7px, var(--well) 7px 10px), repeating-conic-gradient(from 0deg at 50% 120%, ${toneAlpha(30)} 0 3deg, transparent 3deg 14deg), var(--well)`,
  crosshatch: `repeating-linear-gradient(90deg, transparent 0 32px, var(--well) 32px 36px), ${bits(2, toneAlpha(40), '4px 10px')}, var(--well)`,
}

const patternStyles = Object.fromEntries(
  coverPatterns.map((pattern) => [pattern, css({ background: patternBackground[pattern] })]),
) as Record<CoverPattern, ReturnType<typeof css>>

const thumbPatternStyles = Object.fromEntries(
  coverPatterns.map((pattern) => [
    pattern,
    css({ background: thumbOverrides[pattern] ?? patternBackground[pattern] }),
  ]),
) as Record<CoverPattern, ReturnType<typeof css>>

export type SigilSize = 'thumb' | 'thumb-sm' | 'card' | 'banner' | 'art'

export interface SigilProps {
  text: string
  size?: SigilSize
  mix?: MixInput<HTMLElement>
}

/**
 * The outlined Unbounded 800 glyph on a cover (components §9.1). Decorative
 * (`aria-hidden`): the course title carries the name. Colour is `--tone`.
 */
export function Sigil(handle: Handle<SigilProps>) {
  return () => {
    let { text, size = 'card', mix } = handle.props
    return (
      <span aria-hidden="true" class="sigil" mix={[sigilStyle, sigilSizes[size], mix]}>
        {text}
      </span>
    )
  }
}

const sigilStyle = css({
  position: 'relative',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  color: 'transparent',
  WebkitTextStroke: 'var(--sigil-stroke) var(--tone)',
  transition: 'transform var(--duration-sigil) var(--ease-out)',
  '@supports not (-webkit-text-stroke: 1px)': { color: toneAlpha(15) },
})

const sigilSizes: Record<SigilSize, ReturnType<typeof css>> = {
  'thumb-sm': css({ fontSize: 'var(--fs-14)', '--sigil-stroke': '1px', letterSpacing: 'var(--tracking-sigil)' }),
  thumb: css({ fontSize: 'var(--fs-18)', '--sigil-stroke': '1px', letterSpacing: 'var(--tracking-sigil)' }),
  card: css({ fontSize: 'var(--fs-52)', '--sigil-stroke': '1.4px', letterSpacing: '-0.04em' }),
  banner: css({ fontSize: 'var(--fs-88)', '--sigil-stroke': '1.5px', letterSpacing: '-0.05em' }),
  art: css({ fontSize: 'clamp(88px, 30vw, 128px)', '--sigil-stroke': '2px', letterSpacing: '-0.05em' }),
}

export interface CourseCoverProps {
  pattern: CoverPattern
  tone: Tone
  sigil: string
  /** `card` (170px, CourseCard), `banner` (ContinueBanner art), `art` (Course hero, 340 square), `thumb` (Profile 64px). */
  variant?: 'card' | 'banner' | 'art' | 'thumb'
  /** Absolutely-positioned overlays: CoverTag, DoneTag, the art progress chip. */
  children?: RemixNode
  mix?: MixInput<HTMLElement>
}

/** CSS-pattern course cover + sigil (components §9.1, §9.8). Static. */
export function CourseCover(handle: Handle<CourseCoverProps>) {
  return () => {
    let { pattern, tone, sigil, variant = 'card', children, mix } = handle.props
    let sigilSize: SigilSize =
      variant === 'thumb' ? (sigil.length > 3 ? 'thumb-sm' : 'thumb') : variant === 'banner' ? 'banner' : variant
    return (
      <div
        class="cover"
        mix={[
          coverStyle,
          toneVars[tone],
          variant === 'thumb' ? thumbPatternStyles[pattern] : patternStyles[pattern],
          coverVariants[variant],
          mix,
        ]}
      >
        <Sigil text={sigil} size={sigilSize} mix={variant === 'art' ? artFit(sigil) : undefined} />
        {children}
      </div>
    )
  }
}

// The 128px art sigil is drawn for two glyphs ("T°"); longer sigils ("loop",
// "[ctx]") step down so they fit inside the 340px square.
const artFitStyles = {
  3: css({ fontSize: 'min(96px, 26cqi)' }),
  4: css({ fontSize: 'min(76px, 21cqi)' }),
  5: css({ fontSize: 'min(62px, 17cqi)' }),
}
function artFit(sigil: string) {
  let length = [...sigil].length
  return length <= 2 ? undefined : artFitStyles[Math.min(length, 5) as 3 | 4 | 5]
}

const coverStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
})

const coverVariants = {
  card: css({ height: '170px', borderBottom: 'var(--border-w) solid var(--line-hair)' }),
  banner: css({ minHeight: '200px' }),
  art: css({
    containerType: 'inline-size',
    width: '340px',
    maxWidth: '100%',
    aspectRatio: '1',
    borderRadius: 'var(--radius-28)',
    border: `var(--border-w) solid ${toneAlpha(30)}`,
  }),
  thumb: css({ flex: 'none', width: '64px', height: '64px', borderRadius: 'var(--radius-lg)' }),
}
