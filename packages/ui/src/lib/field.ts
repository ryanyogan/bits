/**
 * The shared field (decision 051): one look for every box a learner types
 * into, built on the PromptComposer's input cell and the flat focus of
 * decision 047. Tokens: `--field-*` in `styles/tokens.css`.
 *
 * - A **frame** (`fieldFrameStyle`) is the box: `--field-bg`, the neutral
 *   hairline `--field-border`, `--field-h` tall (`fieldKeyedStyle` with an
 *   md Keycap inside: `--field-h-keyed`). Focus shows on the frame
 *   (built in; `fieldFocus` for a host that draws its own box):
 *   `--focus-border` plus `--focus-ring-soft`, so the
 *   hairline reads as 2px. Only the active "Your turn" frame takes the volt
 *   tint (`fieldActiveStyle`).
 * - The **input** inside (`fieldInputStyle`) is bare: mono 16px
 *   (`--field-font`, `--field-size`, never smaller), a volt caret, `--dim`
 *   placeholder, and no outline of its own. `fieldMultiStyle` makes a
 *   textarea a multi-line prompt.
 * - Prompt windows lead with a volt `›` (`fieldGlyphStyle`).
 * - A lone input that is its own frame (TextField, the tokenizer) takes
 *   `fieldBoxStyle`; sans fields add `fieldSansStyle`.
 *
 * Forced colours: the frame's border and shadow are repainted or dropped,
 * so focus is a transparent outline that forced colours paints
 * (`hiddenOutline`), drawn on the frame.
 */
import { css } from 'remix/component'

import { FOCUS_WITHIN, FORCED_COLORS, hiddenOutline } from './states.ts'

/**
 * Focus on the frame: the hairline turns `--focus-border` and doubles (047).
 * `:focus-within` matches a focused lone input too. Every css() mixin is its
 * own layer and the later one wins, so the frame mixins below repeat these
 * rules rather than relying on a separate mixin's order.
 */
const focusRules = {
  [FOCUS_WITHIN]: {
    ...hiddenOutline,
    borderColor: 'var(--focus-border)',
    boxShadow: 'var(--focus-ring-soft)',
  },
  [FORCED_COLORS]: { [FOCUS_WITHIN]: { outlineColor: 'Highlight' } },
} as const

const frame = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minWidth: 0,
  minHeight: 'var(--field-h)',
  boxSizing: 'border-box',
  padding: '0 var(--field-pad-x)',
  background: 'var(--field-bg)',
  border: 'var(--border-w) solid var(--field-border)',
  cursor: 'text',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:hover:not(:focus-within)': { borderColor: 'var(--field-border-hover)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FOCUS_WITHIN]: focusRules[FOCUS_WITHIN],
  [FORCED_COLORS]: { background: 'Field', borderColor: 'FieldText', [FOCUS_WITHIN]: { outlineColor: 'Highlight' } },
} as const

/** The box around a bare input (and its `›`, key or icon); it shows focus for what it holds. */
export const fieldFrameStyle = css(frame)

/** A frame with an md Keycap inside: tighter on the key's side, `--field-h-keyed` tall. */
export const fieldKeyedStyle = css({
  minHeight: 'var(--field-h-keyed)',
  paddingBlock: 'var(--space-1)',
  paddingRight: 'var(--space-1)',
})

/** The active "Your turn" frame: the one place the resting border is volt. */
export const fieldActiveStyle = css({ borderColor: 'var(--field-border-active)', [FOCUS_WITHIN]: focusRules[FOCUS_WITHIN] })

const input = {
  color: 'var(--text)',
  fontFamily: 'var(--field-font)',
  fontSize: 'var(--field-size)',
  caretColor: 'var(--field-caret)',
  '&::placeholder': { color: 'var(--dim)', opacity: 1 },
} as const

/** The bare input inside a frame: the frame draws the box and the focus. */
export const fieldInputStyle = css({
  ...input,
  flex: 1,
  minWidth: 0,
  // One line fills the frame (less its hairlines), so the whole box is the tap target.
  height: 'calc(var(--field-h) - 2 * var(--border-w))',
  margin: 0,
  padding: 0,
  background: 'transparent',
  border: 0,
  lineHeight: 'normal',
  textOverflow: 'ellipsis',
  '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
})

/** A textarea as a multi-line prompt: three lines tall, grows by dragging. */
export const fieldMultiStyle = css({
  alignSelf: 'stretch',
  height: 'auto',
  minHeight: 'var(--field-min-h-multi)',
  paddingBlock: 'var(--space-3)',
  lineHeight: 'var(--field-leading)',
  resize: 'vertical',
})

/** The volt `›` a prompt window leads with. Decorative: render it `aria-hidden`. */
export const fieldGlyphStyle = css({
  flex: 'none',
  fontFamily: 'var(--field-font)',
  fontSize: 'var(--field-size)',
  fontWeight: 500,
  lineHeight: 'normal',
  color: 'var(--volt)',
  userSelect: 'none',
  [FORCED_COLORS]: { color: 'FieldText' },
})

/** The `›` beside a multi-line prompt: on the first line, not centred. */
export const fieldGlyphTopStyle = css({
  alignSelf: 'flex-start',
  paddingTop: 'var(--space-3)',
  lineHeight: 'var(--field-leading)',
})

/** The rules behind `fieldBoxStyle`, for a lone input that adds states in its own mixin (TextField). */
export const fieldBoxRules = {
  ...frame,
  ...input,
  display: 'block',
  width: '100%',
  margin: 0,
  lineHeight: 'normal',
} as const

/** A lone input that is its own frame (TextField, the tokenizer): frame + input in one element. */
export const fieldBoxStyle = css(fieldBoxRules)

/** Focus for a host that draws its own frame (a ruled cell): add it last. */
export const fieldFocus = css(focusRules)

/** Plain fields (a name, a search) are sans; prompts and answers stay mono. */
export const fieldSansStyle = css({ fontFamily: 'var(--font-sans)', '& input': { fontFamily: 'var(--font-sans)' } })
