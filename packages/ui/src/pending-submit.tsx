import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'

import { Keycap, type KeycapSize, type KeycapVariant } from './keycap.tsx'

export interface PendingSubmitProps {
  label: string
  /** Label while the form submits, e.g. "Verifying…". */
  pendingLabel: string
  variant?: KeycapVariant
  size?: KeycapSize
  block?: boolean
  /** Grow to fill a flex row (the "Verify & continue" key). */
  grow?: boolean
  name?: string
  value?: string
}

/**
 * A submit Keycap that swaps to its pending label, sets `aria-busy` and makes
 * the form's fields read-only once its form submits (Auth spec, "verifying"
 * state). Without JS it is a plain submit button.
 *
 * Every submitter already gets `aria-busy` and double-submit protection from
 * the app's navigation runtime; use this island where the label itself should
 * change. Pending resets when the frame's navigation settles (guide 09, "Add
 * pending feedback"), whatever the outcome, and on `pageshow` (back/forward
 * cache).
 */
export const PendingSubmit = clientEntry(
  import.meta.url,
  function PendingSubmit(handle: Handle<PendingSubmitProps>) {
    let pending = false
    let form: HTMLFormElement | null = null

    let setPending = (value: boolean) => {
      if (pending === value) return
      pending = value
      // Fields are read-only while the request is in flight.
      for (let input of form?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea',
      ) ?? []) {
        input.readOnly = value
      }
      handle.update()
    }

    return () => {
      let { label, pendingLabel, variant = 'primary', size = 'lg', block, grow, name, value } = handle.props
      return (
        <Keycap
          type="submit"
          variant={variant}
          size={size}
          block={block}
          name={name}
          value={value}
          loading={pending}
          mix={[
            grow ? growStyle : undefined,
            ref((node, signal) => {
              form = (node as HTMLButtonElement).form
              // Pending starts with this form's own submit, not any navigation.
              // A submit an earlier listener cancelled isn't one.
              form?.addEventListener('submit', (event) => !event.defaultPrevented && setPending(true), { signal })
              handle.frame.addEventListener('reloadComplete', () => setPending(false), { signal })
              window.addEventListener('pageshow', () => setPending(false), { signal })
            }),
          ]}
        >
          {pending ? pendingLabel : label}
        </Keycap>
      )
    }
  },
)

const growStyle = css({ flex: '1 1 0', minWidth: 'min(100%, 200px)' })
