import type { Handle, MixInput, RemixNode } from 'remix/component'
import { css } from 'remix/component'

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
  mix?: MixInput<HTMLElement>
}

/**
 * Canonical `:::quiz` card (components §6.4): a fieldset of real radios or
 * checkboxes styled as option rows, with correct / incorrect states after
 * submit. Static (a `<form method="post">`).
 */
export function QuizChoice(handle: Handle<QuizChoiceProps>) {
  return () => {
    let { name, question, options, multiple, explanation, action, formAction, mix } = handle.props
    return (
      <form method="post" action={formAction} mix={[cardStyle, mix]}>
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
        {explanation ? (
          <p role="status" mix={explanationStyle}>
            {explanation}
          </p>
        ) : null}
        {action ? <div>{action}</div> : null}
      </form>
    )
  }
}

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3_5)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  fontSize: 'var(--fs-14)',
})
const fieldsetStyle = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })
const questionStyle = css({ padding: 0, marginBottom: 'var(--space-1)', color: 'var(--text)' })
const optionStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
  border: '1px solid var(--line-panel)',
  color: 'var(--text-quiet)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '&:hover': { borderColor: 'var(--line-node-next)' },
  '&:has(:checked)': { borderColor: 'var(--volt-a60)', background: 'var(--volt-tint-on)', color: 'var(--volt-soft)' },
  '&:has(:focus-visible)': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  '&[data-result="correct"]': { borderColor: 'var(--volt-a45)', background: 'var(--volt-tint-on)', color: 'var(--volt-soft)' },
  '&[data-result="incorrect"]': { borderColor: 'var(--warn-line)', background: 'var(--warn-tint)', color: 'var(--warn)' },
})
const markStyle = css({ fontFamily: 'var(--font-mono)', width: '1em', textAlign: 'center' })
const explanationStyle = css({ margin: 0, fontSize: 'var(--fs-14)', lineHeight: 1.55, color: 'var(--muted)' })
