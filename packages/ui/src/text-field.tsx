import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { hiddenOutline } from './lib/states.ts'

export interface TextFieldProps {
  name: string
  label: string
  type?: 'text' | 'email' | 'search' | 'url' | 'password' | 'tel'
  /** Initial value (uncontrolled). */
  value?: string
  placeholder?: string
  /** Validation message; sets `aria-invalid` and the danger border (resolutions §1). */
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'numeric' | 'url' | 'tel' | 'search'
  /** The mobile keyboard's return key: `go`, `send`, `next`, `done`, `search`. */
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  /**
   * Defaults suit the type: `email`, `url` and mono fields don't
   * auto-capitalise or spell-check (an "Ada@…" or a red squiggle under a
   * handle helps nobody).
   */
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'
  spellCheck?: boolean
  pattern?: string
  maxLength?: number
  /** Focus on load, e.g. the first invalid field after a 422 re-render. */
  autoFocus?: boolean
  /** Geist Mono 15px (emails, codes) instead of Geist 16px. */
  mono?: boolean
  /** Authoring compact variant: 44px, label above in 13px muted. */
  compact?: boolean
  id?: string
  /** Style-guide only: show the focused look. */
  forceFocus?: boolean
  mix?: MixInput<HTMLElement>
}

/** Labelled text input (components §7.1). Static; works in any native form. */
export function TextField(handle: Handle<TextFieldProps>) {
  return () => {
    let {
      name,
      label,
      type = 'text',
      value,
      error,
      hint,
      mono,
      compact,
      id = `field-${name}`,
      forceFocus,
      mix,
      autoCapitalize,
      spellCheck,
      enterKeyHint,
      ...input
    } = handle.props
    let literal = type === 'email' || type === 'url' || type === 'password' || mono
    let describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined

    return (
      <div mix={[fieldStyle, compact ? compactField : undefined, mix]}>
        <label for={id} mix={compact ? compactLabel : labelStyle}>
          {label}
        </label>
        <input
          {...input}
          id={id}
          name={name}
          type={type as 'text'}
          defaultValue={value}
          autoCapitalize={autoCapitalize ?? (literal ? 'none' : undefined)}
          spellCheck={spellCheck ?? (literal ? false : undefined)}
          enterkeyhint={enterKeyHint}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          data-force={forceFocus ? 'focus' : undefined}
          mix={[inputStyle, mono ? monoStyle : undefined, compact ? compactInput : undefined]}
        />
        {hint ? (
          <p id={`${id}-hint`} mix={hintStyle}>
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} mix={errorStyle}>
            {error}
          </p>
        ) : null}
      </div>
    )
  }
}

const fieldStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 })
const compactField = css({ gap: 'var(--space-1_5)' })

const labelStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--text-body)' })
const compactLabel = css({ fontSize: 'var(--fs-13)', color: 'var(--muted)' })

export const inputStyle = css({
  width: '100%',
  minHeight: 'var(--control-field)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: 'var(--border-w) solid var(--line-strong)',
  background: 'var(--well)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-16)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&::placeholder': { color: 'var(--dim)', opacity: 1 },
  '&:focus, &[data-force="focus"]': {
    ...hiddenOutline,
    borderColor: 'var(--focus-border)',
    boxShadow: 'var(--focus-ring)',
  },
  '&[aria-invalid="true"]': { borderColor: 'var(--danger-line)' },
  '&[aria-invalid="true"]:focus': { borderColor: 'var(--danger)', boxShadow: 'var(--focus-ring-danger)' },
  '&:disabled': { color: 'var(--dim)', cursor: 'not-allowed', borderColor: 'var(--line)', borderStyle: 'solid' },
  // Read-only (and read-only while its form is pending): dashed, no caret change.
  '&:read-only:not(:disabled)': { borderStyle: 'dashed' },
})

const monoStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-15)' })

const compactInput = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
})

const hintStyle = css({ fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })
const errorStyle = css({ fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--danger)' })
