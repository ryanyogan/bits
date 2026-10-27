import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FORCED_COLORS, forcedSvgPaint } from './lib/states.ts'

/**
 * The icon set from components.md §2, copied verbatim and re-coloured through
 * tokens. Every icon is decorative (`aria-hidden`, not focusable) unless a
 * `label` is given, in which case it becomes `role="img"`.
 */
export type IconName =
  | 'github'
  | 'globe'
  | 'key'
  | 'mail'
  | 'search'
  | 'chevron-left'
  | 'play'
  | 'play-inline'
  | 'pause'
  | 'copy'
  | 'check'
  | 'hex'
  | 'flame'
  | 'tutor'
  | 'folder-upload'
  | 'hex-check'
  | 'menu'
  | 'close'
  | 'book'

interface IconDef {
  viewBox: string
  /** Default rendered width × height in px (the artboard size). */
  size: [number, number]
  /** Default colour token; `currentColor` follows the text colour. */
  color: string
  draw(color: string): RemixNode
}

const HEX = 'M11 1.5 L19.2 6.25 L19.2 15.75 L11 20.5 L2.8 15.75 L2.8 6.25 Z'

export const icons: Record<IconName, IconDef> = {
  github: {
    viewBox: '0 0 24 24',
    size: [18, 18],
    color: 'var(--text)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round">
        <circle cx="6" cy="5" r="2.2" />
        <circle cx="6" cy="19" r="2.2" />
        <circle cx="18" cy="8" r="2.2" />
        <path d="M6 7.2 V16.8 M18 10.2 C18 14 12 13 6.5 16.8" />
      </g>
    ),
  },
  globe: {
    viewBox: '0 0 24 24',
    size: [18, 18],
    color: 'var(--text)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12 H21 M12 3 C15 6 15 18 12 21 C9 18 9 6 12 3" />
      </g>
    ),
  },
  key: {
    viewBox: '0 0 24 24',
    size: [18, 18],
    color: 'var(--volt)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round">
        <circle cx="8" cy="9" r="4" />
        <path d="M11 12 L20 21 M16 17 L18.5 14.5 M18 20 L20 18" />
      </g>
    ),
  },
  mail: {
    viewBox: '0 0 24 24',
    size: [28, 28],
    color: 'var(--volt)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.8" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3.5 6.5 L12 13 L20.5 6.5" />
      </g>
    ),
  },
  search: {
    viewBox: '0 0 24 24',
    size: [18, 18],
    color: 'var(--muted)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20 L16 16" />
      </g>
    ),
  },
  'chevron-left': {
    viewBox: '0 0 16 16',
    size: [16, 16],
    color: 'var(--text)',
    draw: (c) => <path d="M10 3 L5 8 L10 13" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" />,
  },
  play: {
    viewBox: '0 0 20 22',
    size: [20, 22],
    color: 'var(--ink)',
    draw: (c) => <path d="M3 2 L18 11 L3 20 Z" fill={c} />,
  },
  'play-inline': {
    viewBox: '0 0 12 14',
    size: [12, 14],
    color: 'var(--ion)',
    draw: (c) => <path d="M1 1 L11 7 L1 13 Z" fill={c} />,
  },
  pause: {
    viewBox: '0 0 12 14',
    size: [12, 14],
    color: 'var(--text)',
    draw: (c) => (
      <g fill={c}>
        <rect x="1" y="1" width="3.5" height="12" rx="1" />
        <rect x="7.5" y="1" width="3.5" height="12" rx="1" />
      </g>
    ),
  },
  copy: {
    viewBox: '0 0 14 14',
    size: [12, 12],
    color: 'currentColor',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.6">
        <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" />
        <path d="M9.5 4.5 V2.5 A1 1 0 0 0 8.5 1.5 H2.5 A1 1 0 0 0 1.5 2.5 V8.5 A1 1 0 0 0 2.5 9.5 H4.5" />
      </g>
    ),
  },
  check: {
    viewBox: '0 0 14 14',
    size: [14, 14],
    color: 'var(--on-volt)',
    draw: (c) => (
      <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke={c} stroke-width="2" fill="none" stroke-linecap="round" />
    ),
  },
  hex: {
    viewBox: '0 0 22 22',
    size: [14, 14],
    color: 'var(--volt)',
    draw: (c) => <path d={HEX} fill={c} />,
  },
  flame: {
    viewBox: '0 0 14 16',
    size: [14, 16],
    color: 'var(--ion)',
    draw: (c) => (
      <path d="M7 1 C8 4 12 6 12 10 A5 5 0 0 1 2 10 C2 7.5 4 6.5 4.5 4.5 C5.5 6 6 6.5 7 1 Z" fill={c} />
    ),
  },
  tutor: {
    viewBox: '0 0 18 18',
    size: [18, 18],
    color: 'var(--on-volt)',
    draw: (c) => (
      <g fill="none">
        <circle cx="4" cy="4" r="2" fill={c} />
        <circle cx="14" cy="4" r="2" fill={c} />
        <circle cx="9" cy="14" r="2.4" fill={c} />
        <path d="M4 4 L9 14 L14 4" stroke={c} stroke-width="1.4" />
      </g>
    ),
  },
  'folder-upload': {
    viewBox: '0 0 24 24',
    size: [44, 44],
    color: 'var(--volt)',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7 A2 2 0 0 1 5 5 H9 L11 7 H19 A2 2 0 0 1 21 9 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 Z" />
        <path d="M12 10 V16 M9.5 12.5 L12 10 L14.5 12.5" />
      </g>
    ),
  },
  'hex-check': {
    viewBox: '0 0 22 22',
    size: [40, 40],
    color: 'var(--on-volt)',
    draw: (c) => (
      <g>
        <path d={HEX} fill={c} />
        <path d="M7 11.5 L10 14 L15 8" stroke="var(--volt)" stroke-width="1.8" fill="none" stroke-linecap="round" />
      </g>
    ),
  },
  menu: {
    viewBox: '0 0 20 20',
    size: [20, 20],
    color: 'currentColor',
    draw: (c) => <path d="M3 6h14M3 10h14M3 14h14" stroke={c} stroke-width="1.6" stroke-linecap="round" />,
  },
  close: {
    viewBox: '0 0 20 20',
    size: [20, 20],
    color: 'currentColor',
    draw: (c) => <path d="M5 5 L15 15 M15 5 L5 15" stroke={c} stroke-width="1.6" stroke-linecap="round" />,
  },
  book: {
    viewBox: '0 0 20 20',
    size: [18, 18],
    color: 'currentColor',
    draw: (c) => (
      <g fill="none" stroke={c} stroke-width="1.6" stroke-linejoin="round">
        <path d="M10 5 C8 3.6 5.5 3.2 2.5 3.5 V15.5 C5.5 15.2 8 15.6 10 17 C12 15.6 14.5 15.2 17.5 15.5 V3.5 C14.5 3.2 12 3.6 10 5 Z" />
        <path d="M10 5 V17" />
      </g>
    ),
  },
}

export const iconNames = Object.keys(icons) as IconName[]

export interface IconProps {
  name: IconName
  /** Square size in px, or explicit width (height scales with the viewBox). Defaults to the artboard size. */
  size?: number
  /** Any CSS colour, normally a token: `var(--ion)`. Defaults to the icon's artboard colour. */
  color?: string
  /** Accessible name. Omit for decorative icons (the default). */
  label?: string
}

/** An inline SVG icon. Server-rendered, no JS. */
export function Icon(handle: Handle<IconProps>) {
  return () => {
    let { name, size, color, label } = handle.props
    let def = icons[name]
    let [w, h] = def.size
    let width = size ?? w
    let height = size ? Math.round((size * h) / w) : h

    return (
      <svg
        width={width}
        height={height}
        viewBox={def.viewBox}
        fill="none"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
        focusable="false"
        mix={iconStyle}
      >
        {def.draw(color ?? def.color)}
      </svg>
    )
  }
}

// Icons keep their drawn size inside tight flex rows (e.g. the XP pill in a
// 360px app bar) instead of being squeezed to a sliver.
const iconStyle = css({ flex: 'none', [FORCED_COLORS]: forcedSvgPaint })
