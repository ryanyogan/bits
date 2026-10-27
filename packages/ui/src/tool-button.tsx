import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { ACTIVE, busyStyle, DISABLED, FOCUS, focusOutline, FORCED_COLORS, forcedSelected, HOVER, type ForcedState } from './lib/states.ts'

export type ToolButtonVariant = 'outline' | 'quiz' | 'video'

export interface ToolButtonProps {
  /**
   * `outline` (34px "⌨ Type it" toggle, `aria-pressed` = on), `quiz` (40px
   * terminal quiz options), `video` (40px filled player controls).
   */
  variant?: ToolButtonVariant
  /** Square icon-only button (video play/pause). Needs `label`. */
  square?: boolean
  label?: string
  pressed?: boolean
  type?: 'button' | 'submit'
  name?: string
  value?: string
  disabled?: boolean
  forceState?: ForcedState
  mix?: MixInput<HTMLElement>
  children?: RemixNode
}

/**
 * Mono button for dense tool contexts (components §5.3). Visual sizes
 * 34/40px keep a 44px hit area (resolutions §7). Static; islands add `on()`
 * behaviour through `mix`.
 */
export function ToolButton(handle: Handle<ToolButtonProps>) {
  return () => {
    let { variant = 'outline', square, label, pressed, type = 'button', name, value, disabled, forceState, mix, children } =
      handle.props
    return (
      <button
        type={type}
        name={name}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
        data-force={forceState}
        mix={[baseStyle, variantStyles[variant], square ? squareStyle : undefined, busyStyle, mix]}
      >
        {children}
      </button>
    )
  }
}

export const toolButtonBase = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-1_5)',
  border: 'var(--border-w) solid var(--line-control)',
  background: 'transparent',
  color: 'var(--text-quiet)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast)',
  '&::before': { content: '""', position: 'absolute', inset: '-5px -1px' },
  [HOVER]: { background: 'var(--fill-btn)' },
  [ACTIVE]: { background: 'var(--fill-tab-on)' },
  [FOCUS]: focusOutline,
  [DISABLED]: { color: 'var(--dim)', cursor: 'not-allowed', borderColor: 'var(--line)' },
})

// Each variant repeats this after its own pressed colours: a rule in the base
// mixin loses to the variant's (each css() is its own layer; decision 025).
const forcedPressed = { '&[aria-pressed="true"]': forcedSelected }

const baseStyle = toolButtonBase

const variantStyles: Record<ToolButtonVariant, ReturnType<typeof css>> = {
  outline: css({
    minHeight: 'var(--control-xs)',
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    '&[aria-pressed="true"]': { background: 'var(--volt-a14)', color: 'var(--volt-soft)', borderColor: 'var(--volt-a50)' },
    [FORCED_COLORS]: forcedPressed,
  }),
  quiz: css({
    minHeight: 'var(--control-compact)',
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-9)',
    color: 'var(--text)',
    fontSize: 'var(--fs-13)',
    '&::before': { inset: '-2px -1px' },
    '&[aria-pressed="true"]': { background: 'var(--volt-tint-on)', color: 'var(--volt-soft)', borderColor: 'var(--volt-a60)' },
    [FORCED_COLORS]: forcedPressed,
  }),
  video: css({
    minHeight: 'var(--control-compact)',
    minWidth: 'var(--control-compact)',
    padding: '0 var(--space-2_5)',
    borderRadius: 'var(--radius-10)',
    border: 0,
    background: 'var(--fill-btn)',
    color: 'var(--text)',
    fontSize: 'var(--fs-13)',
    '&::before': { inset: '-2px' },
    [HOVER]: { background: 'var(--fill-tab-on)' },
    '&[aria-pressed="true"]': { color: 'var(--ion)' },
    [FORCED_COLORS]: forcedPressed,
  }),
}

const squareStyle = css({ width: 'var(--control-compact)', padding: 0 })
