import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { TextField } from '@bits/ui/text-field'

export interface DeleteConfirmProps {
  /** The handle the person must type. */
  handle: string
  value?: string
  error?: string
}

/**
 * The delete-account confirmation inside its `<details>` (Settings §6). The
 * server checks the typed handle, so it works without JS; with JS the key
 * stays disabled until the handle matches, and opening the disclosure moves
 * focus to the field.
 */
export const DeleteConfirm = clientEntry(
  import.meta.url,
  function DeleteConfirm(handle: Handle<DeleteConfirmProps>) {
    let enhanced = false
    let typed = handle.props.value ?? ''

    handle.queueTask(() => {
      enhanced = true
      handle.update()
    })

    let matches = () => typed.trim().replace(/^@/, '').toLowerCase() === handle.props.handle.toLowerCase()

    return () => {
      let { handle: userHandle, value, error } = handle.props
      return (
        <div
          mix={[
            wrapStyle,
            on('input', (event) => {
              let target = event.target as HTMLInputElement
              if (target.name !== 'confirm') return
              let before = matches()
              typed = target.value
              if (before !== matches()) handle.update()
            }),
            ref((node, signal) => {
              let details = node.closest('details')
              details?.addEventListener(
                'toggle',
                () => {
                  if (details.open) requestAnimationFrame(() => node.querySelector<HTMLInputElement>('input[name="confirm"]')?.focus())
                },
                { signal },
              )
            }),
          ]}
        >
          <TextField
            id="delete-confirm"
            name="confirm"
            label="Type your handle to confirm"
            placeholder={userHandle}
            value={value}
            error={error}
            autoComplete="off"
            mono
            autoFocus={Boolean(error)}
            mix={fieldStyle}
          />
          <Keycap
            type="submit"
            variant="danger"
            disabled={enhanced && !matches()}
            aria-describedby="delete-confirm-hint"
            mix={keyStyle}
          >
            Delete account forever
          </Keycap>
          <p id="delete-confirm-hint" class="sr-only">
            {`Type ${userHandle} above to enable this button.`}
          </p>
        </div>
      )
    }
  },
)

const wrapStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' })
const fieldStyle = css({ alignSelf: 'stretch' })
const keyStyle = css({ '@media (max-width: 480px)': { alignSelf: 'stretch' } })
