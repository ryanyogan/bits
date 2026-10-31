import type { Handle, MixInput } from 'remix/component'
import { css } from 'remix/component'

import { focusOutline, FORCED_COLORS, forcedSelected } from './lib/states.ts'

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
  /** Two options (Public / Private), or three (System / Dark / Light). */
  options: [SwitchOption, SwitchOption] | [SwitchOption, SwitchOption, SwitchOption]
  value?: string
  disabled?: boolean
  mix?: MixInput<HTMLElement>
}

/**
 * Two- or three-option switch (components §7.7, proposed): no toggle is
 * drawn, so it is the `account` segmented flavour bound to native radios
 * (Public / Private; System / Dark / Light). Works in plain forms; selection styled with `:has(:checked)`.
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
  // One equal column per option (two or three).
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(0, 1fr)',
  gap: 'var(--space-1)',
  padding: 'var(--space-1)',
  borderRadius: 'var(--radius-13)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line)',
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
  '&:hover:not(:has(:disabled))': { color: 'var(--text)' },
  '&:has(:checked)': { background: 'var(--selected)', color: 'var(--text)' },
  [FORCED_COLORS]: { '&:has(:checked)': forcedSelected },
  '&:has(:focus-visible)': focusOutline,
  'fieldset:disabled &': { cursor: 'not-allowed' },
})
