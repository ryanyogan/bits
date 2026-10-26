import type { Handle } from 'remix/component'
import { css } from 'remix/component'

export interface FormFieldProps {
  name: string
  label: string
  type?: 'text' | 'email'
  value?: string
  error?: string
  hint?: string
  required?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'numeric'
  pattern?: string
  maxLength?: number
}

/**
 * Minimal labelled input used by the auth placeholders. The component agent
 * replaces this with the design-system input in packages/ui.
 */
export function FormField(handle: Handle<FormFieldProps>) {
  return () => {
    let { name, label, type = 'text', value, error, hint, ...input } = handle.props
    let id = `field-${name}`
    let describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

    return (
      <div mix={fieldStyle}>
        <label htmlFor={id} mix={labelStyle}>
          {label}
        </label>
        <input
          id={id}
          name={name}
          type={type}
          list={undefined}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          mix={inputStyle}
          {...input}
        />
        {error ? (
          <p id={`${id}-error`} mix={errorStyle}>
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} mix={hintStyle}>
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
}

const fieldStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' })

const labelStyle = css({ fontSize: 'var(--type-ui-size)', fontWeight: 500, color: 'var(--text)' })

const inputStyle = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--line-strong)',
  background: 'var(--raised)',
  color: 'var(--text)',
  font: 'inherit',
  '&:focus-visible': { borderColor: 'var(--volt)' },
  '&[aria-invalid]': { borderColor: 'var(--synapse)' },
})

const hintStyle = css({ fontSize: '13px', color: 'var(--dim)' })

const errorStyle = css({ fontSize: '13px', color: 'var(--synapse)' })
