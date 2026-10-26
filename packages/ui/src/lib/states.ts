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
/** The focus outline every custom-styled control repeats when it sets its own box-shadow. */
export const focusOutline = {
  outline: '2px solid var(--focus-ring-color)',
  outlineOffset: '2px',
} as const
