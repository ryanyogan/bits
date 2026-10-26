import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'
import { Keycap, type KeycapSize, type KeycapVariant } from '@bits/ui/keycap'

export interface PendingSubmitProps {
  label: string
  /** Label while the form submits, e.g. "Verifying…". */
  pendingLabel: string
  variant?: KeycapVariant
  size?: KeycapSize
  block?: boolean
  /** Grow to fill a flex row (the "Verify & continue" key). */
  grow?: boolean
}

/**
 * A submit Keycap that shows its pending label and `aria-busy` once its form
 * submits (Auth spec, "verifying" state). Without JS it is a plain submit button.
 */
export const PendingSubmit = clientEntry(
  import.meta.url,
  function PendingSubmit(handle: Handle<PendingSubmitProps>) {
    let pending = false
    let form: HTMLFormElement | null = null

    let setPending = (value: boolean) => {
      if (pending === value) return
      pending = value
      // Inputs are read-only while the request is in flight.
      for (let input of form?.querySelectorAll('input:not([type="hidden"])') ?? []) {
        ;(input as HTMLInputElement).readOnly = value
      }
      handle.update()
    }

    return () => {
      let { label, pendingLabel, variant = 'primary', size = 'lg', block, grow } = handle.props
      return (
        <Keycap
          type="submit"
          variant={variant}
          size={size}
          block={block}
          loading={pending}
          mix={[
            grow ? growStyle : undefined,
            ref((node, signal) => {
              form = (node as HTMLButtonElement).form
              // Pending starts with this form's own submit, not any navigation.
              form?.addEventListener('submit', () => setPending(true), { signal })
              // With client navigation a 422/429 re-render reconciles into this
              // same instance, so reset when the frame's navigation settles
              // (guide 09, "Add pending feedback"), whatever the outcome.
              handle.frame.addEventListener('reloadComplete', () => setPending(false), { signal })
              // Back/forward cache: reset when the page is shown again.
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
