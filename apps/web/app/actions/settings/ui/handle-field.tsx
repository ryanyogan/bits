import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { inputStyle } from '@bits/ui/text-field'

export interface HandleFieldProps {
  name: string
  label: string
  value?: string
  error?: string
  hint?: string
  /** Static prefix shown inside the field, e.g. "bits.dev/u/". */
  prefix: string
  autoFocus?: boolean
}

/**
 * TextField with a static prefix inside its left padding (Settings §1,
 * Handle). The prefix hides at ≤400px and moves into the hint instead.
 */
export function HandleField(handle: Handle<HandleFieldProps>) {
  return () => {
    let { name, label, value, error, hint, prefix, autoFocus } = handle.props
    let id = `field-${name}`
    let describedBy = [error ? `${id}-error` : null, `${id}-hint`].filter(Boolean).join(' ')
    return (
      <div mix={fieldStyle}>
        <label for={id} mix={labelStyle}>
          {label}
        </label>
        <div mix={groupStyle}>
          <span aria-hidden="true" mix={prefixStyle}>
            {prefix}
          </span>
          <input
            id={id}
            name={name}
            type="text"
            defaultValue={value}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            required
            autoFocus={autoFocus}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            mix={[inputStyle, handleInputStyle]}
          />
        </div>
        <p id={`${id}-hint`} mix={hintStyle}>
          <span mix={narrowPrefixStyle}>{`Your profile lives at ${prefix}${value ?? ''}. `}</span>
          {hint}
        </p>
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
const labelStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--text-body)' })
const groupStyle = css({ position: 'relative', display: 'flex', alignItems: 'center' })

const prefixStyle = css({
  position: 'absolute',
  left: 'calc(var(--field-pad-x) + var(--border-w))',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--field-size)',
  color: 'var(--dim)',
  pointerEvents: 'none',
  '@media (max-width: 400px)': { display: 'none' },
})

// "bits.dev/u/" is 11 mono characters (11ch at the field's 16px), plus the field padding.
const handleInputStyle = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--field-size)',
  paddingLeft: 'calc(var(--field-pad-x) + 11ch)',
  '@media (max-width: 400px)': { paddingLeft: 'var(--field-pad-x)' },
})

const hintStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })
const narrowPrefixStyle = css({ display: 'none', '@media (max-width: 400px)': { display: 'inline' } })
const errorStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--danger)' })
