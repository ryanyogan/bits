import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { Callout } from '@bits/ui/callout'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'

export interface AddPasskeyProps {
  /** `POST /api/passkey/register-options`. */
  optionsUrl: string
}

/**
 * "Add a passkey" (Settings, sign-in methods). Without JS it is a submit
 * button whose stub action explains that passkeys need JavaScript. With JS
 * it runs the (stubbed) WebAuthn registration: "Waiting for your device…"
 * with `aria-busy`, then the warn message when it fails.
 */
export const AddPasskey = clientEntry(import.meta.url, function AddPasskey(handle: Handle<AddPasskeyProps>) {
  let busy = false
  let failed = false

  async function register(event: Event) {
    event.preventDefault()
    if (busy) return
    busy = true
    failed = false
    let signal = await handle.update()
    try {
      if (typeof window.PublicKeyCredential !== 'function') throw new Error('unsupported')
      let response = await fetch(handle.props.optionsUrl, { method: 'POST', signal })
      if (!response.ok) throw new Error(String(response.status))
      // TODO(auth): navigator.credentials.create(options) → verify → add the row.
      throw new Error('not implemented')
    } catch {
      if (signal.aborted) return
      failed = true
    }
    busy = false
    handle.update()
  }

  return () => (
    <div mix={wrapStyle}>
      <Keycap type="submit" name="intent" value="add-passkey" loading={busy} mix={on('click', (event) => register(event))}>
        <Icon name="key" color="var(--on-volt)" />
        {busy ? 'Waiting for your device…' : 'Add a passkey'}
      </Keycap>
      <div role="status">
        {failed ? (
          <Callout tone="warning" compact>
            Passkey wasn't added. Try again.
          </Callout>
        ) : null}
      </div>
    </div>
  )
})

const wrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  '@media (max-width: 480px)': { alignItems: 'stretch' },
})
