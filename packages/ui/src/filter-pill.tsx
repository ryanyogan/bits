import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { FOCUS, type ForcedState } from './lib/states.ts'

export interface FilterPillProps {
  /** URL with the filter applied, e.g. `?track=agents` (filters are URL state, resolutions §11). */
  href: string
  /** Track colour of the dot, e.g. `var(--track-agents)`. Omit for the "All" pill. */
  dot?: string
  /** Result count shown after the label. */
  count?: number
  selected?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * Catalog track filter (components §6.2c). A link with `aria-current` when
 * selected; place a set inside `<nav aria-label="Filter by track">`. Static.
 */
export function FilterPill(handle: Handle<FilterPillProps>) {
  return () => {
    let { href, dot, count, selected, forceState, mix, children } = handle.props
    return (
      <a
        href={href}
        aria-current={selected ? 'true' : undefined}
        data-force={forceState}
        mix={[pillStyle, mix]}
      >
        <span
          aria-hidden="true"
          mix={dotStyle}
          style={dot ? { background: dot } : undefined}
          data-all={dot ? undefined : 'true'}
        />
        <span>{children}</span>
        {count !== undefined ? (
          <span mix={countStyle}>
            <span class="sr-only">(</span>
            {count}
            <span class="sr-only"> courses)</span>
          </span>
        ) : null}
      </a>
    )
  }
}

const pillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text-quiet)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-15)',
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  transition:
    'background-color var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast)',
  '&:not([aria-current="true"]):hover, &[data-force="hover"]': {
    borderColor: 'var(--line-node-next)',
    color: 'var(--text-quiet)',
  },
  '&[aria-current="true"]': {
    borderColor: 'var(--text)',
    background: 'var(--text)',
    color: 'var(--ink)',
  },
  [FOCUS]: { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})

const dotStyle = css({
  flex: 'none',
  width: '7px',
  height: '7px',
  borderRadius: 'var(--radius-pill)',
  '&[data-all="true"]': { background: 'var(--text)' },
  // The "All" dot would vanish on the selected (text-coloured) pill: use ink (README §C).
  '[aria-current="true"] > &[data-all="true"]': { background: 'var(--ink)' },
})

const countStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
  // Resolutions §6: #4A5068 on #ECEEF5 when selected.
  '[aria-current="true"] > &': { color: 'var(--code-gutter)' },
})
