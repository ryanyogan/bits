import { css } from 'remix/component'

/**
 * The pending look for a submit button that isn't a Keycap (decision 024): the
 * navigation runtime sets `aria-busy="true"` on a form's submitter while its
 * POST is in flight, and this draws Keycap's blinking caret after the label.
 * The caret's alternative text is empty, so it stays out of the button's name.
 */
export const busyCaret = css({
  '&[aria-busy="true"]': { cursor: 'progress' },
  '&[aria-busy="true"]::after': {
    content: '"▍" / ""',
    marginLeft: 'var(--space-1_5)',
    animation: 'bits-blink var(--duration-caret) steps(1) infinite',
  },
  '@media (prefers-reduced-motion: reduce)': { '&[aria-busy="true"]::after': { animation: 'none' } },
})
