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
 * A bar or dot that shows an amount with its background (progress fills,
 * odds bars, the current-lesson dot). Forced colours would drop it, so keep
 * it painted in the text colour (decision 025).
 */
export const forcedFill = { forcedColorAdjust: 'none', background: 'CanvasText' } as const
/**
 * The same for a fill whose colour arrives as an inline `background` (the
 * inline style beats any rule): an inset shadow paints over it instead.
 */
export const forcedInlineFill = { forcedColorAdjust: 'none', boxShadow: 'inset 0 0 0 999px CanvasText' } as const
/** The empty part of a bar: a hairline frame, so the fill reads as a share of it. */
export const forcedTrack = { outline: '1px solid CanvasText', outlineOffset: '0' } as const
/**
 * SVG drawn with token colours in its attributes (icons, the brand mark):
 * forced colours never touch `fill`/`stroke`, so a light glyph vanished on a
 * light high-contrast canvas. CSS beats presentation attributes, so draw
 * every painted part in the (forced) text colour.
 */
export const forcedSvgPaint = {
  '& [fill]:not([fill="none"])': { fill: 'currentColor' },
  '& [stroke]:not([stroke="none"])': { stroke: 'currentColor' },
} as const
/** `<mark>` with a translucent tint: forced colours keep the alpha, so paint the Mark pair solid. */
export const forcedMark = { forcedColorAdjust: 'none', background: 'Mark', color: 'MarkText' } as const
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
