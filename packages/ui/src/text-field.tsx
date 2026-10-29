import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { fieldBoxRules } from './lib/field.ts'

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
  /** Geist Mono (emails, handles, codes) instead of Geist; 16px either way (decision 051). */
  mono?: boolean
  /** Authoring compact variant: 44px, label above in 13px muted; the text stays 16px. */
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
          mix={[inputStyle, mono || compact ? monoStyle : undefined, compact ? compactInput : undefined]}
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

/**
 * The shared field (decision 051) as a lone input: `--field-*` box, 16px,
 * volt caret, flat focus (047). Plain fields are sans; `mono` (emails,
 * handles, codes) takes the field font at the same 16px. Exported for
 * selects and custom inputs that should match (settings handle, admin).
 */
export const inputStyle = css({
  ...fieldBoxRules,
  fontFamily: 'var(--font-sans)',
  '&[aria-invalid="true"]': { borderColor: 'var(--danger-line)' },
  '&[aria-invalid="true"]:focus': { borderColor: 'var(--danger)', boxShadow: 'var(--focus-ring-danger)' },
  '&:disabled': { color: 'var(--dim)', cursor: 'not-allowed', borderColor: 'var(--line)', borderStyle: 'solid' },
  // Read-only (and read-only while its form is pending): dashed, no caret change.
  '&:read-only:not(:disabled)': { borderStyle: 'dashed' },
})

const monoStyle = css({ fontFamily: 'var(--field-font)' })

const compactInput = css({
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
})

const hintStyle = css({ fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })
const errorStyle = css({ fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--danger)' })
