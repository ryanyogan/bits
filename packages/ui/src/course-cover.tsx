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
 * Pattern backgrounds, each on `--well`. Colours come from `--tone` through
 * `color-mix()`, so one recipe serves volt, ion and synapse at the alphas the
 * Catalog script uses. `thumb` is the scaled Profile-thumbnail recipe.
 */
const patternBackground: Record<CoverPattern, string> = {
  dots: `radial-gradient(${toneAlpha(45)} 1.2px, transparent 1.6px) 0 0 / 14px 14px, var(--well)`,
  'stripes-115': `repeating-linear-gradient(115deg, ${toneAlpha(0)} 0 12px, ${toneAlpha(30)} 12px 13px), var(--well)`,
  rules: `linear-gradient(${toneAlpha(22)} 1px, transparent 1px) 0 0 / 100% 18px, var(--well)`,
  grid: `linear-gradient(90deg, ${toneAlpha(28)} 1px, transparent 1px) 0 0 / 22px 100%, linear-gradient(${toneAlpha(28)} 1px, transparent 1px) 0 0 / 100% 22px, var(--well)`,
  rings: `repeating-radial-gradient(circle at 85% 110%, transparent 0 14px, ${toneAlpha(42)} 14px 15px), var(--well)`,
  'dots-offset': `radial-gradient(${toneAlpha(50)} 1.4px, transparent 1.8px) 0 0 / 18px 18px, radial-gradient(${toneAlpha(25)} 1px, transparent 1.4px) 9px 9px / 18px 18px, var(--well)`,
  rays: `repeating-conic-gradient(from 0deg at 50% 120%, ${toneAlpha(28)} 0 2deg, transparent 2deg 12deg), var(--well)`,
  crosshatch: `repeating-linear-gradient(45deg, ${toneAlpha(22)} 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, ${toneAlpha(22)} 0 1px, transparent 1px 16px), var(--well)`,
}

const thumbOverrides: Partial<Record<CoverPattern, string>> = {
  'stripes-115': `repeating-linear-gradient(115deg, ${toneAlpha(0)} 0 6px, ${toneAlpha(35)} 6px 7px), var(--well)`,
  rays: `repeating-conic-gradient(from 0deg at 50% 120%, ${toneAlpha(30)} 0 3deg, transparent 3deg 14deg), var(--well)`,
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
