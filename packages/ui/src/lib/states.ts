/**
 * Interaction-state selectors shared by components.
 *
 * Each selector matches the real pseudo-class and a `data-force` attribute,
 * so the style guide can render hover, pressed and focus states statically
 * (`forceState="hover"`) with exactly the CSS the live state uses. Hover and
 * press never apply to disabled controls. They are literal-typed constants so
 * they can be used as computed keys in css() objects.
 */
export type ForcedState = 'hover' | 'active' | 'focus'

export const HOVER = '&:hover:not(:disabled):not([aria-disabled="true"]), &[data-force="hover"]'
export const ACTIVE = '&:active:not(:disabled):not([aria-disabled="true"]), &[data-force="active"]'
export const FOCUS = '&:focus-visible, &[data-force="focus"]'
export const DISABLED = '&:disabled, &[aria-disabled="true"]'
/** For containers whose focus shows on an inner control. */
export const FOCUS_WITHIN = '&:focus-within, &[data-force="focus"]'
/**
 * Windows High Contrast / `forced-colors`: the browser drops backgrounds and
 * box-shadows, so a selected or pressed state drawn with a tint vanishes.
 * Repaint that state with the system highlight pair inside this media query
 * (system colours, not literals: they follow the user's contrast theme).
 */
export const FORCED_COLORS = '@media (forced-colors: active)'
export const forcedSelected = {
  forcedColorAdjust: 'none',
  background: 'Highlight',
  color: 'HighlightText',
  borderColor: 'Highlight',
} as const
/**
 * Fields that draw focus with a border + glow hide the outline. A transparent
 * outline is invisible normally, but forced-colors paints it, so keyboard
 * focus never disappears in high-contrast mode.
 */
export const hiddenOutline = { outline: '2px solid transparent', outlineOffset: '2px' } as const
/** The focus outline every custom-styled control repeats when it sets its own box-shadow. */
export const focusOutline = {
  outline: '2px solid var(--focus-ring-color)',
  outlineOffset: '2px',
} as const
