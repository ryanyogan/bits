import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { focusOutline, FORCED_COLORS, forcedSelected } from './lib/states.ts'
import { toyBodyStyle, toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'

export interface QuizOption {
  value: string
  label: string
  /** After submit: mark this option. */
  result?: 'correct' | 'incorrect'
  checked?: boolean
}

export interface QuizChoiceProps {
  name: string
  question: RemixNode
  options: QuizOption[]
  /** Checkboxes instead of radios. */
  multiple?: boolean
  /** Shown under the options after a submit. */
  explanation?: RemixNode
  /** Usually a primary Keycap "Check" (type submit). */
  action?: RemixNode
  /** Form action; the quiz is a plain POST form so it works without JS. */
  formAction?: string
  /** Mono label in the header strip (default "quick check"). */
  label?: string
  mix?: MixInput<HTMLElement>
}

/**
 * Canonical `:::quiz` card (components §6.4): a fieldset of real radios or
 * checkboxes styled as option rows, with correct / incorrect states after
 * submit. Static (a `<form method="post">`).
 */
export function QuizChoice(handle: Handle<QuizChoiceProps>) {
  return () => {
    let { name, question, options, multiple, explanation, action, formAction, label = 'quick check', mix } = handle.props
    return (
      // Checking re-renders this same card: keep focus on the Check key and
      // the scroll where it is, so keyboard and screen-reader users stay in
      // place (scrolling to the action's #fragment would blur the key), and
      // don't stack a history entry per attempt. Without JS the fragment
      // brings the browser back to the card.
      <form
        method="post"
        action={formAction}
        data-rmx-reset-focus="manual"
        data-rmx-reset-scroll="manual"
        data-rmx-history="replace"
        mix={[toyPanelStyle, mix]}
      >
        <div mix={toyHeaderStyle}>
          <span mix={[toyLabelStyle, labelTone]}>{label}</span>
        </div>
        <div mix={[toyBodyStyle, bodyStyle]}>
          <fieldset mix={fieldsetStyle}>
            <legend mix={questionStyle}>{question}</legend>
            {options.map((option) => (
              <label key={option.value} data-result={option.result} mix={optionStyle}>
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={name}
                  value={option.value}
                  defaultChecked={option.checked}
                  class="sr-only"
                />
                <span aria-hidden="true" mix={markStyle}>
                  {option.result === 'correct' ? '✓' : option.result === 'incorrect' ? '!' : '◯'}
                </span>
                <span>{option.label}</span>
                {option.result ? (
                  <span class="sr-only">{option.result === 'correct' ? ' — correct' : ' — not quite'}</span>
                ) : null}
              </label>
            ))}
          </fieldset>
          {/* Always mounted, so the explanation is announced when a check adds it. */}
          <div role="status" mix={statusStyle}>
            {explanation ? <p mix={explanationStyle}>{explanation}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      </form>
    )
  }
}

const labelTone = css({ color: 'var(--synapse)' })
const bodyStyle = css({ gap: 'var(--space-3_5)', fontSize: 'var(--fs-15)' })
// The options are one ruled list: rows share their hairlines (no gaps).
const fieldsetStyle = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', flexDirection: 'column' })
const questionStyle = css({ padding: 0, marginBottom: 'var(--space-3_5)', fontSize: 'var(--fs-16)', lineHeight: 1.5, color: 'var(--text)' })
const optionStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 'var(--touch-target)',
  padding: 'var(--space-2) var(--space-3_5)',
  border: 'var(--border-w) solid var(--line-panel)',
  background: 'var(--well)',
  color: 'var(--text-quiet)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  // Shared hairlines: each row tucks its top border under the one above.
  '& + &': { marginTop: 'calc(-1 * var(--border-w))' },
  // A marked row draws its whole border over its neighbours'.
  '&:hover, &:has(:checked), &[data-result]': { zIndex: 1 },
  '&:not([data-result]):hover': { borderColor: 'var(--line-node-next)', background: 'var(--fill-hover)' },
  // The pick: a 2px bar on the leading edge, a tint, the accent as a signal.
  '&:has(:checked)': { borderColor: 'var(--volt-a45)', background: 'var(--volt-tint-on)', color: 'var(--volt-soft)', boxShadow: 'inset 2px 0 0 var(--volt)' },
  '&:has(:focus-visible)': { ...focusOutline, outlineOffset: 'var(--focus-offset-inset)', zIndex: 2 },
  '&[data-result="correct"]': { borderColor: 'var(--volt-a45)', background: 'var(--volt-tint-on)', color: 'var(--volt-soft)', boxShadow: 'inset 2px 0 0 var(--volt)' },
  '&[data-result="incorrect"]': { borderColor: 'var(--warn-line)', background: 'var(--warn-tint)', color: 'var(--warn)', boxShadow: 'inset 2px 0 0 var(--warn)' },
  // The ✓ / ! marks carry the result in forced colours; selection gets the highlight pair.
  [FORCED_COLORS]: { '&:has(:checked)': forcedSelected },
})
// Empty: out of the flex flow (no extra gap) but still a live region.
const statusStyle = css({
  '&:empty': { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' },
})
const markStyle = css({ flex: 'none', fontFamily: 'var(--font-mono)', width: '1em', textAlign: 'center' })
const explanationStyle = css({
  margin: 0,
  paddingLeft: 'var(--space-3_5)',
  borderLeft: 'var(--border-w) solid var(--line-strong)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.55,
  color: 'var(--text-body)',
})
