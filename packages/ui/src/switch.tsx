import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

export interface SwitchOption {
  value: string
  label: string
}

export interface SwitchProps {
  /** Radio group name. */
  name: string
  /** Visible legend; set `hideLegend` to keep it for screen readers only. */
  legend: string
  hideLegend?: boolean
  options: [SwitchOption, SwitchOption]
  value?: string
  disabled?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * Two-option switch (components §7.7, proposed): no toggle is drawn, so it is
 * the `account` segmented flavour bound to two native radios (e.g. Public /
 * Private). Works in plain forms; selection styled with `:has(:checked)`.
 */
export function Switch(handle: Handle<SwitchProps>) {
  return () => {
    let { name, legend, hideLegend, options, value = options[0].value, disabled, mix } = handle.props
    return (
      <fieldset disabled={disabled} mix={[fieldsetStyle, mix]}>
        <legend class={hideLegend ? 'sr-only' : undefined} mix={legendStyle}>
          {legend}
        </legend>
        <div mix={trackStyle}>
          {options.map((option) => (
            <label key={option.value} mix={optionStyle}>
              <input type="radio" name={name} value={option.value} defaultChecked={option.value === value} class="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }
}

const fieldsetStyle = css({
  margin: 0,
  padding: 0,
  border: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  '&:disabled': { opacity: 0.5 },
})

const legendStyle = css({ padding: 0, marginBottom: 'var(--space-2)', fontSize: 'var(--fs-14)', color: 'var(--text-body)' })

const trackStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-1)',
  padding: 'var(--space-1)',
  borderRadius: 'var(--radius-13)',
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
})

const optionStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'var(--touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-10)',
  color: 'var(--muted)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), color var(--duration-fast)',
  '&:hover': { color: 'var(--text)' },
  '&:has(:checked)': { background: 'var(--selected)', color: 'var(--text)' },
  '&:has(:focus-visible)': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  'fieldset:disabled &': { cursor: 'not-allowed' },
})
