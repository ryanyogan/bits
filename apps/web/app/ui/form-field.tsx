import type { Handle } from 'remix/component'
import { TextField } from '@bits/ui/text-field'

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
 * The auth pages' labelled input: the design-system TextField with the
 * email/code options these pages use (danger error state, resolutions §1).
 */
export function FormField(handle: Handle<FormFieldProps>) {
  return () => {
    let { type = 'text', ...props } = handle.props
    return <TextField {...props} type={type} mono={type === 'email' || props.inputMode === 'numeric'} />
  }
}
