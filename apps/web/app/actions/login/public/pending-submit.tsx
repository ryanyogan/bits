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
              let form = (node as HTMLButtonElement).form
              form?.addEventListener(
                'submit',
                () => {
                  pending = true
                  handle.update()
                  // Inputs are read-only while the request is in flight.
                  for (let input of form.querySelectorAll('input:not([type="hidden"])')) {
                    ;(input as HTMLInputElement).readOnly = true
                  }
                },
                { signal },
              )
              // Back/forward cache: reset when the page is shown again.
              window.addEventListener(
                'pageshow',
                () => {
                  if (!pending) return
                  pending = false
                  for (let input of form?.querySelectorAll('input:not([type="hidden"])') ?? []) {
                    ;(input as HTMLInputElement).readOnly = false
                  }
                  handle.update()
                },
                { signal },
              )
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
