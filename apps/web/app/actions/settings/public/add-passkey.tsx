import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'
import { browserSupportsWebAuthn, startRegistration, WebAuthnAbortService, WebAuthnError } from '@simplewebauthn/browser'
import { Callout } from '@bits/ui/callout'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'

export interface AddPasskeyProps {
  /** `POST /api/passkey/register-options`: a fresh challenge (JSON). */
  optionsUrl: string
}

/**
 * "Add a passkey" (Settings, sign-in methods; decision 030). It sits inside
 * the `POST /settings/methods` form. Without JS it is a plain submit whose
 * action explains that passkeys need JavaScript. With JS it fetches options,
 * runs `navigator.credentials.create()` ("Waiting for your device…" with
 * `aria-busy`) and submits the form with the browser's answer in
 * `response`; the server verifies it and redirects back with a notice.
 */
export const AddPasskey = clientEntry(import.meta.url, function AddPasskey(handle: Handle<AddPasskeyProps>) {
  let busy = false
  let failure = ''
  let field: HTMLInputElement | undefined

  handle.signal.addEventListener('abort', () => WebAuthnAbortService.cancelCeremony())

  async function register(event: Event) {
    event.preventDefault()
    if (busy) return
    let button = event.currentTarget as HTMLButtonElement
    busy = true
    failure = ''
    handle.update()
    try {
      if (!browserSupportsWebAuthn()) throw new Error('unsupported')
      let response = await fetch(handle.props.optionsUrl, { method: 'POST' })
      if (response.status === 409) throw new Error('limit')
      if (!response.ok) throw new Error(String(response.status))
      let result = await startRegistration({ optionsJSON: await response.json() })
      if (!field || !button.form) return
      field.value = JSON.stringify(result)
      // The form navigation takes over from here; leave the key busy.
      button.form.requestSubmit(button)
      return
    } catch (error) {
      if (handle.signal.aborted) return
      failure = describe(error)
    }
    busy = false
    handle.update()
  }

  return () => (
    <div mix={wrapStyle}>
      <input type="hidden" name="response" mix={ref((node) => (field = node as HTMLInputElement))} />
      <Keycap type="submit" name="intent" value="add-passkey" loading={busy} mix={on('click', (event) => register(event))}>
        <Icon name="key" color="var(--on-volt)" />
        {busy ? 'Waiting for your device…' : 'Add a passkey'}
      </Keycap>
      <div role="status">
        {failure ? (
          <Callout tone="warning" compact>
            {failure}
          </Callout>
        ) : null}
      </div>
    </div>
  )
})

function describe(error: unknown): string {
  if (error instanceof WebAuthnError && error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return 'This device already has a passkey for your account.'
  }
  let message = (error as Error)?.message
  if (message === 'unsupported') return 'This browser can’t make passkeys. Try another browser or device.'
  if (message === 'limit') return 'You have the most passkeys an account can hold. Remove one first.'
  return 'Passkey wasn’t added. Try again.'
}

const wrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  '@media (max-width: 480px)': { alignItems: 'stretch' },
})
