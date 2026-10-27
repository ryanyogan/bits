import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { hiddenOutline } from './lib/states.ts'

export interface CodeInputProps {
  /** Field name of the combined code. */
  name?: string
  /** Legend, visually hidden. */
  label?: string
  length?: number
  /** Error message: every box turns danger and the message is announced. */
  error?: string
  /** Submit the enclosing form when the last digit is typed. */
  autoSubmit?: boolean
  /** Prefill (e.g. after a 422 re-render). */
  value?: string
  disabled?: boolean
  /**
   * Focus the first box on load, and after a client-navigation re-render
   * (the navigation's focus reset lands on the `autofocus` element), so a
   * wrong code puts the cursor straight back in the boxes.
   */
  autoFocus?: boolean
}

/**
 * The 6-digit sign-in code (components §7.3). Progressive: the server renders
 * one `autocomplete="one-time-code"` input that works without JS; as a client
 * entry it upgrades to six boxes (type to advance, Backspace goes back, paste
 * fills all, optional auto-submit) that write the same named value.
 */
export const CodeInput = clientEntry(
  import.meta.url,
  function CodeInput(handle: Handle<CodeInputProps>) {
    let enhanced = false
    let digits: string[] = []
    let boxes: HTMLInputElement[] = []
    let root: HTMLElement | undefined

    handle.queueTask(() => {
      let length = handle.props.length ?? 6
      let initial = (handle.props.value ?? '').replace(/\D/g, '').slice(0, length)
      digits = Array.from({ length }, (_, i) => initial[i] ?? '')
      // The server-rendered single input may hold focus (autofocus); hand it to the first box.
      let hadFocus = root?.contains(document.activeElement) ?? false
      enhanced = true
      handle.update().then(() => {
        if (hadFocus || (handle.props.autoFocus && document.activeElement === document.body)) boxes[0]?.focus()
      })
    })

    function setFrom(index: number, text: string) {
      let length = digits.length
      let clean = text.replace(/\D/g, '')
      if (!clean) return
      for (let i = 0; i < clean.length && index + i < length; i++) digits[index + i] = clean[i]!
      let next = Math.min(index + clean.length, length - 1)
      handle.update().then(() => {
        boxes[next]?.focus()
        boxes[next]?.select()
        if (handle.props.autoSubmit && digits.every(Boolean)) {
          root?.closest('form')?.requestSubmit()
        }
      })
    }

    return () => {
      let { name = 'code', label = '6-digit code', length = 6, error, disabled, autoFocus } = handle.props
      let errorId = error ? `${name}-code-error` : undefined
      let focusFirst = Boolean(autoFocus)

      return (
        <fieldset
          disabled={disabled}
          aria-describedby={errorId}
          mix={[fieldsetStyle, ref((node) => (root = node))]}
        >
          <legend class="sr-only">{label}</legend>
          {enhanced ? (
            <>
              <input type="hidden" name={name} value={digits.join('')} />
              <div mix={gridStyle} style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
                {digits.map((digit, index) => (
                  <label key={index} mix={boxLabel}>
                    <span class="sr-only">{`Digit ${index + 1}`}</span>
                    <input
                      inputMode="numeric"
                      enterkeyhint="go"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={length}
                      value={digit}
                      autoFocus={index === 0 && focusFirst ? true : undefined}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={errorId}
                      mix={[
                        boxStyle,
                        ref((node) => (boxes[index] = node)),
                        on('focus', (event) => event.currentTarget.select()),
                        on('input', (event) => {
                          let text = event.currentTarget.value
                          if (!/\d/.test(text)) {
                            digits[index] = ''
                            event.currentTarget.value = ''
                            return
                          }
                          // Typing over a filled box leaves "old+new": keep the newest digits.
                          setFrom(index, text.length > 1 && digit ? text.replace(digit, '') || text : text)
                        }),
                        on('paste', (event) => {
                          event.preventDefault()
                          setFrom(index, event.clipboardData?.getData('text') ?? '')
                        }),
                        on('keydown', (event) => {
                          if (event.key === 'Backspace' && !digits[index] && index > 0) {
                            event.preventDefault()
                            digits[index - 1] = ''
                            handle.update().then(() => boxes[index - 1]?.focus())
                          } else if (event.key === 'Backspace') {
                            digits[index] = ''
                            handle.update()
                          } else if (event.key === 'ArrowLeft' && index > 0) {
                            boxes[index - 1]?.focus()
                          } else if (event.key === 'ArrowRight' && index < length - 1) {
                            boxes[index + 1]?.focus()
                          }
                        }),
                      ]}
                    />
                  </label>
                ))}
              </div>
            </>
          ) : (
            <input
              name={name}
              inputMode="numeric"
              pattern={`[0-9 ]{${length},${length + 1}}`}
              maxLength={length + 1}
              autoComplete="one-time-code"
              enterkeyhint="go"
              required
              defaultValue={handle.props.value}
              autoFocus={focusFirst ? true : undefined}
              aria-label={label}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={errorId}
              mix={[boxStyle, singleStyle]}
            />
          )}
          {/* Always mounted, so a new error is announced (a live region that
              appears together with its text often isn't). */}
          <p id={`${name}-code-error`} aria-live="polite" mix={errorStyle}>
            {error ?? ''}
          </p>
        </fieldset>
      )
    }
  },
)

const fieldsetStyle = css({
  margin: 0,
  padding: 0,
  border: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
})

const gridStyle = css({ display: 'grid', gap: 'var(--space-2)' })

const boxLabel = css({ display: 'block', minWidth: 0 })

const boxStyle = css({
  display: 'block',
  width: '100%',
  height: '60px',
  padding: 0,
  textAlign: 'center',
  borderRadius: 'var(--radius-12)',
  border: '1px solid var(--line-control)',
  background: 'var(--well)',
  color: 'var(--text)',
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  fontSize: 'var(--fs-22)',
  caretColor: 'var(--volt)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  '&:focus': { ...hiddenOutline, borderColor: 'var(--focus-border)', boxShadow: 'var(--focus-ring)' },
  '&[aria-invalid="true"]': { borderColor: 'var(--danger-line)' },
  '&[aria-invalid="true"]:focus': { borderColor: 'var(--danger)', boxShadow: '0 0 0 4px var(--danger-tint)' },
  // Read-only while the form submits (PendingSubmit), disabled with the fieldset.
  '&:read-only': { borderStyle: 'dashed' },
  '&:disabled': { color: 'var(--dim)', borderColor: 'var(--line)', borderStyle: 'solid', cursor: 'not-allowed' },
})

const singleStyle = css({
  letterSpacing: '0.5em',
  paddingLeft: '0.5em',
  fontFamily: 'var(--font-mono)',
})

const errorStyle = css({
  // Empty: out of the layout but still in the accessibility tree, so it stays a live region.
  '&:empty': { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' },
  margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--danger)' })
