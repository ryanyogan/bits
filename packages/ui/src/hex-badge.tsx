import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS } from './lib/states.ts'

const HEX = 'M11 1.5 L19.2 6.25 L19.2 15.75 L11 20.5 L2.8 15.75 L2.8 6.25 Z'

export interface HexBadgeProps {
  /** Badge name (accessible name of `earned`/`locked`). */
  name: string
  /** Glyph inside the hex, e.g. "T°". */
  glyph?: string
  /** Fill colour, e.g. `var(--ion)`. */
  color?: string
  /** `earned` 56, `locked` 56, `preview` 40 (Course, dashed ion), `chip` 22 (BadgeChip). */
  variant?: 'earned' | 'locked' | 'preview' | 'chip'
  mix?: MixInput<SVGSVGElement>
}

/**
 * Hexagon badge (components §11.1). Locked badges keep full opacity with a
 * dashed `--dim` outline (README contrast fix). Static.
 */
export function HexBadge(handle: Handle<HexBadgeProps>) {
  return () => {
    let { name, glyph = '', color = 'var(--volt)', variant = 'earned', mix } = handle.props
    if (variant === 'chip') {
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" mix={[svgStyle, mix]}>
          <path d={HEX} style={{ fill: color }} />
          <circle cx="11" cy="11" r="3" style={{ fill: 'var(--ink)' }} />
        </svg>
      )
    }
    if (variant === 'preview') {
      return (
        <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true" mix={[svgStyle, mix]}>
          <path d={HEX} fill="none" stroke-width="1.2" stroke-dasharray="2 2" style={{ stroke: color }} />
          <text x="11" y="14" text-anchor="middle" mix={[glyphStyle, previewGlyph]} style={{ fill: color }}>
            {glyph}
          </text>
        </svg>
      )
    }
    let locked = variant === 'locked'
    return (
      <svg
        width="56"
        height="56"
        viewBox="0 0 22 22"
        role="img"
        aria-label={locked ? `${name} — locked` : name}
        mix={[svgStyle, mix]}
      >
        <path
          d={HEX}
          stroke-width="0.6"
          stroke-dasharray={locked ? '1 1' : '0'}
          style={locked ? { fill: 'transparent', stroke: 'var(--dim)' } : { fill: color, stroke: color }}
        />
        <text
          x="11"
          y="13.2"
          text-anchor="middle"
          mix={[glyphStyle, gridGlyph]}
          style={{ fill: locked ? 'var(--muted)' : 'var(--ink)' }}
        >
          {glyph}
        </text>
      </svg>
    )
  }
}

const svgStyle = css({ flex: 'none', display: 'block', overflow: 'visible' })
const glyphStyle = css({ fontFamily: 'var(--font-display)', fontWeight: 700 })
const gridGlyph = css({ fontSize: '5px' })
const previewGlyph = css({ fontSize: '6px' })

export interface BadgeTileProps {
  name: string
  glyph: string
  color?: string
  locked?: boolean
}

/**
 * Profile badge grid item: hex + name, as one cell of a shared-border grid
 * (`CellGrid as="ul"` or `badgeGridStyle`; decision 047). Flat: hover steps
 * the fill, nothing lifts. An earned badge marks the cell's top edge with a
 * short 2px tick in its colour; a locked one keeps its dashed outline and a
 * quieter name. Static.
 */
export function BadgeTile(handle: Handle<BadgeTileProps>) {
  return () => {
    let { name, glyph, color, locked } = handle.props
    return (
      <li
        data-locked={locked ? 'true' : undefined}
        mix={tileStyle}
        style={locked ? undefined : { '--badge-tone': color ?? 'var(--volt)' }}
      >
        <HexBadge name={name} glyph={glyph} color={color} variant={locked ? 'locked' : 'earned'} mix={tileHex} />
        <span aria-hidden="true" mix={tileName}>
          {name}
        </span>
      </li>
    )
  }
}

const PHONE = '@media (max-width: 480px)'

/**
 * A boxed 3-up grid of `BadgeTile`s with shared hairlines, for a list that
 * sits inside padding (the styleguide). On a ruled page, use
 * `<CellGrid as="ul" pad={false}>` instead.
 */
export const badgeGridStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  borderInline: 'var(--border-w) solid var(--line-cell)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '& > *': {
    borderTop: 'var(--border-w) solid var(--line-cell)',
    borderRight: 'var(--border-w) solid var(--line-cell)',
  },
  '& > :nth-child(3n)': { borderRight: 0 },
  [FORCED_COLORS]: { borderColor: 'GrayText', '& > *': { borderColor: 'GrayText' } },
})
const tileStyle = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minWidth: 0,
  padding: 'var(--space-5) var(--space-2) var(--space-4)',
  textAlign: 'center',
  transition: 'background-color var(--duration-fast) var(--ease)',
  '&:hover': { background: 'var(--cell-fill-hover)' },
  // The earned colour as a signal: a short 2px tick on the cell's top edge.
  '&:not([data-locked])::before': {
    content: '""',
    position: 'absolute',
    top: 'calc(-1 * var(--border-w))',
    left: '50%',
    width: 'var(--space-6)',
    height: 'var(--border-w-strong)',
    transform: 'translateX(-50%)',
    background: 'var(--badge-tone)',
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { '&:not([data-locked])::before': { display: 'none' } },
  [PHONE]: { padding: 'var(--space-4) var(--space-1) var(--space-3_5)' },
})
// 48px (40px on phones) inside a cell; the bare HexBadge stays 56.
const tileHex = css({ width: '48px', height: '48px', [PHONE]: { width: '40px', height: '40px' } })
const tileName = css({
  fontSize: 'var(--fs-12)',
  lineHeight: 1.3,
  color: 'var(--text-quiet)',
  overflowWrap: 'anywhere',
  '[data-locked] > &': { color: 'var(--muted)' },
})

export interface BadgeChipProps {
  name: string
  color?: string
  mix?: MixInput<HTMLElement>
}

/** Pill with a chip hex + name (components §11.2). Static. */
export function BadgeChip(handle: Handle<BadgeChipProps>) {
  return () => {
    let { name, color, mix } = handle.props
    return (
      <span mix={[chipStyle, mix]}>
        <HexBadge name={name} color={color} variant="chip" />
        {name}
      </span>
    )
  }
}

const chipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  border: 'var(--border-w) solid var(--line-panel)',
  background: 'var(--well)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text-body)',
  whiteSpace: 'nowrap',
})
