import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FOCUS, HOVER, type ForcedState } from './lib/states.ts'

export interface SegmentedTabItem {
  label: RemixNode
  href: string
  current?: boolean
  /** Style-guide only. */
  forceState?: ForcedState
}

export type SegmentedTabsFlavour = 'mode' | 'account'

export interface SegmentedTabsProps {
  /** Accessible name of the group, e.g. "Lesson format". */
  label: string
  items: SegmentedTabItem[]
  /** `mode` (Read / Watch / Terminal, 38px items), `account` (2-up grid, 44px items). */
  flavour?: SegmentedTabsFlavour
  mix?: MixInput<HTMLElement>
}

/**
 * URL-backed segmented tabs (components §6.1, resolutions §11): a `<nav>` of
 * links, the current one marked `aria-current="page"`. No JS. For tabs that
 * switch client-only panels use `TabPanels` instead.
 */
export function SegmentedTabs(handle: Handle<SegmentedTabsProps>) {
  return () => {
    let { label, items, flavour = 'mode', mix } = handle.props
    return (
      <nav aria-label={label} mix={[flavour === 'account' ? accountTrack : modeTrack, mix]}>
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            data-force={item.forceState}
            mix={[itemBase, flavour === 'account' ? accountItem : modeItem]}
          >
            {item.label}
          </a>
        ))}
      </nav>
    )
  }
}

export interface StaticTabsProps {
  items: string[]
  /** Index of the selected segment. */
  selected?: number
  /** `md` (System, 13px) or `sm` (Main lesson preview, 12px). */
  size?: 'md' | 'sm'
  mix?: MixInput<HTMLElement>
}

/**
 * The decorative, non-interactive tabs drawn in System and the Main lesson
 * preview (components §6.1 `mode-static`). Hidden from assistive tech: it is a
 * picture of tabs, not a control.
 */
export function StaticTabs(handle: Handle<StaticTabsProps>) {
  return () => {
    let { items, selected = 0, size = 'md', mix } = handle.props
    return (
      <span aria-hidden="true" mix={[staticTrack, size === 'sm' ? staticTrackSm : undefined, mix]}>
        {items.map((item, index) => (
          <span key={item} data-selected={index === selected ? 'true' : undefined} mix={[staticItem, size === 'sm' ? staticItemSm : undefined]}>
            {item}
          </span>
        ))}
      </span>
    )
  }
}

/* Shared with TabPanels (segmented-tab-panels.tsx). */
export const modeTrack = css({
  display: 'inline-flex',
  alignSelf: 'flex-start',
  gap: 'var(--space-0_5)',
  padding: 'var(--space-0_75)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
})

export const accountTrack = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-1)',
  padding: 'var(--space-1)',
  borderRadius: 'var(--radius-13)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
})

export const itemBase = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  background: 'transparent',
  color: 'var(--muted)',
  font: 'inherit',
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), color var(--duration-fast)',
  [HOVER]: { color: 'var(--text)' },
  '&[aria-current="page"], &[aria-selected="true"]': {
    background: 'var(--selected)',
    color: 'var(--text)',
  },
  [FOCUS]: { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px', zIndex: 1 },
})

export const modeItem = css({
  minHeight: '38px',
  padding: '0 var(--space-3_5)',
  borderRadius: 'var(--radius-sm)',
  // 38px visual, 44px hit area across the track padding (resolutions §7).
  '&::before': { content: '""', position: 'absolute', inset: '-4px 0' },
  '@media (max-width: 360px)': { padding: '0 var(--space-2_5)' },
})

export const accountItem = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
})

const staticTrack = css({
  display: 'inline-flex',
  alignSelf: 'flex-start',
  gap: 'var(--space-0_5)',
  padding: 'var(--space-0_75)',
  borderRadius: 'var(--radius-10)',
  background: 'var(--fill-seg)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 'normal',
})

const staticTrackSm = css({ borderRadius: 'var(--radius-9)', fontSize: 'var(--fs-12)' })

const staticItem = css({
  padding: 'var(--space-1_75) var(--space-3)',
  borderRadius: 'var(--radius-7)',
  color: 'var(--muted)',
  '&[data-selected="true"]': { background: 'var(--fill-tab-on)', color: 'var(--text)' },
})

const staticItemSm = css({
  padding: 'var(--space-1_25) var(--space-2_5)',
  borderRadius: 'var(--radius-xs)',
})
