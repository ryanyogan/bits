import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { prefetchFor, type PrefetchProp } from './lib/prefetch.ts'
import { FOCUS, focusOutline, FORCED_COLORS, forcedSelected, HOVER, type ForcedState } from './lib/states.ts'

export interface ChoiceChipProps {
  /** Form field name; the chip is a real checkbox (or radio) inside a label. */
  name: string
  value: string
  type?: 'checkbox' | 'radio'
  defaultChecked?: boolean
  disabled?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * Toggle chip (components §6.2a, Auth goals). A visually hidden native
 * checkbox inside a label, styled with `:has(:checked)`, so it works in a
 * plain form with no JS. Static.
 */
export function ChoiceChip(handle: Handle<ChoiceChipProps>) {
  return () => {
    let { name, value, type = 'checkbox', defaultChecked, disabled, forceState, mix, children } =
      handle.props
    return (
      <label data-force={forceState} mix={[chipBase, choiceStyle, mix]}>
        <input
          type={type}
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          disabled={disabled}
          class="sr-only"
        />
        {children}
      </label>
    )
  }
}

export interface ChipProps {
  /** Selected look (volt tint). Use for display-only chips such as the System sample. */
  selected?: boolean
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Display-only chip (System "Agents / Prompting / Foundations"). Static. */
export function Chip(handle: Handle<ChipProps>) {
  return () => {
    let { selected, mix, children } = handle.props
    return (
      <span data-selected={selected ? 'true' : undefined} mix={[chipBase, staticStyle, mix]}>
        {children}
      </span>
    )
  }
}

export interface SuggestionChipProps {
  /** A link chip. Without it the chip is a button (an ask's option, which fills the answer field). */
  href?: string
  /** Prefetch the page on hover/focus (`intent`, the default), on `viewport`, or not (`false`). Decision 042. */
  prefetch?: PrefetchProp
  /** Button chips: `submit` sends `name=value` with its form (the no-JS pick). Default `button`. */
  type?: 'button' | 'submit'
  name?: string
  value?: string
  /** Button chips: a toggled pick (`aria-pressed`, volt tint). */
  pressed?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/** Link chip over the landing field (components §6.2b, `.chip-link`), or a button chip. Static. */
export function SuggestionChip(handle: Handle<SuggestionChipProps>) {
  return () => {
    let { href, prefetch, type = 'button', name, value, pressed, forceState, mix, children } = handle.props
    if (href === undefined) {
      return (
        <button
          type={type}
          name={name}
          value={value}
          aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
          data-force={forceState}
          mix={[chipBase, suggestionStyle, buttonChipStyle, mix]}
        >
          {children}
        </button>
      )
    }
    return (
      <a href={href} data-rmx-prefetch={prefetchFor(href, prefetch)} data-force={forceState} mix={[chipBase, suggestionStyle, mix]}>
        {children}
      </a>
    )
  }
}

const chipBase = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  borderRadius: 'var(--radius-pill)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text-lead)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-14)',
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  transition:
    'border-color var(--duration-fast), color var(--duration-fast), background-color var(--duration-fast)',
})

const on = {
  borderColor: 'var(--volt-a60)',
  background: 'var(--volt-tint-on)',
  color: 'var(--volt-soft)',
}

const choiceStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3_5)',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover:not(:has(:disabled)), &[data-force="hover"]': { borderColor: 'var(--line-node-next)' },
  '&:has(:checked)': on,
  '&:has(:focus-visible), &[data-force="focus"]': {
    outline: 'var(--focus-outline)',
    outlineOffset: 'var(--focus-offset)',
    boxShadow: 'var(--focus-ring)',
  },
  '&:has(:disabled)': { cursor: 'not-allowed', color: 'var(--dim)', borderColor: 'var(--line)' },
  '&:has(:checked:disabled)': { opacity: 0.6 },
  [FORCED_COLORS]: { '&:has(:checked)': forcedSelected },
})

const staticStyle = css({
  padding: 'var(--space-2_25) var(--space-3_5)',
  '&[data-selected="true"]': on,
  [FORCED_COLORS]: { '&[data-selected="true"]': forcedSelected },
})

const suggestionStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3_5)',
  borderColor: 'var(--line-strong)',
  background: 'var(--ink-a55)',
  [HOVER]: {
    borderColor: 'var(--volt-a55)',
    color: 'var(--text)',
    background: 'var(--volt-a06)',
  },
  [FOCUS]: focusOutline,
})

// A button chip: the label may be a sentence, so it wraps instead of
// overflowing a phone; a toggled pick takes the volt tint.
const buttonChipStyle = css({
  cursor: 'pointer',
  whiteSpace: 'normal',
  textAlign: 'start',
  paddingBlock: 'var(--space-2)',
  '&[aria-pressed="true"]': on,
  [FORCED_COLORS]: { '&[aria-pressed="true"]': forcedSelected },
})
