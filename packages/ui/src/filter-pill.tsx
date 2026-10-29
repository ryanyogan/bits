import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
import { FOCUS, focusOutline, FORCED_COLORS, forcedSelected, type ForcedState } from './lib/states.ts'

export interface FilterPillProps {
  /** URL with the filter applied, e.g. `?track=agents` (filters are URL state, resolutions §11). */
  href: string
  /** Track colour of the dot, e.g. `var(--track-agents)`. Omit for the "All" pill. */
  dot?: string
  /** Result count shown after the label. */
  count?: number
  selected?: boolean
  /**
   * `pill` (default): a bordered key on its own. `cell`: a full-height cell
   * of a ruled toolbar (decision 047), divided from the next by a hairline;
   * put a set in a row whose box draws the outer lines.
   */
  variant?: 'pill' | 'cell'
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
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
    let { href, dot, count, selected, variant = 'pill', prefetch, forceState, mix, children } = handle.props
    return (
      <a
        href={href}
        aria-current={selected ? 'true' : undefined}
        data-rmx-prefetch={prefetchFor(href, prefetch)}
        data-force={forceState}
        mix={[pillStyle, variant === 'cell' ? cellStyle : undefined, mix]}
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
  border: 'var(--border-w) solid var(--line-control)',
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
  // Selected (decision 047, calmer): a quiet fill step, the text at full
  // strength and a 2px volt underline inside the box, like the landing nav.
  '&[aria-current="true"]': {
    borderColor: 'var(--line-strong)',
    background: 'var(--selected)',
    color: 'var(--text)',
    boxShadow: 'inset 0 calc(-1 * var(--border-w-strong)) 0 var(--volt)',
  },
  [FOCUS]: focusOutline,
  [FORCED_COLORS]: { '&[aria-current="true"]': forcedSelected },
})

const dotStyle = css({
  flex: 'none',
  width: '7px',
  height: '7px',
  borderRadius: 'var(--radius-round)',
  '&[data-all="true"]': { background: 'var(--text-quiet)' },
})

const countStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
  '[aria-current="true"] > &': { color: 'var(--muted)' },
})

// A cell of a ruled toolbar: no box of its own, full height, a hairline on
// its right; hover is a fill step. The focus outline sits inside, where the
// neighbouring cells can't cover it.
const cellStyle = css({
  minHeight: 'var(--control-lg)',
  padding: '0 var(--space-5)',
  border: 0,
  borderRight: 'var(--border-w) solid var(--line-cell)',
  '&:not([aria-current="true"]):hover, &[data-force="hover"]': {
    background: 'var(--fill-hover)',
    color: 'var(--text)',
  },
  '&[aria-current="true"]': { border: 0, borderRight: 'var(--border-w) solid var(--line-cell)' },
  [FOCUS]: { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  [FORCED_COLORS]: { borderRightColor: 'GrayText' },
})
