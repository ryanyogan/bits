import type { Handle } from 'remix/component'
import { clientEntry, css, on } from 'remix/component'
import { ProviderButton } from '@bits/ui/provider-button'

export interface PasskeyButtonProps {
  /** `POST /api/passkey/login-options`. */
  optionsUrl: string
  next?: string
}

/**
 * "Use a passkey" (Auth spec, providers). WebAuthn needs JS, so the server
 * renders the button disabled and the browser enables it. The ceremony
 * itself lands with the auth milestone: today the options endpoint answers
 * 501 and the button says so.
 */
export const PasskeyButton = clientEntry(
  import.meta.url,
  function PasskeyButton(handle: Handle<PasskeyButtonProps>) {
    let ready = false
    let busy = false
    let message = ''

    handle.queueTask(() => {
      ready = typeof window.PublicKeyCredential === 'function'
      if (!ready) message = 'This browser can’t use passkeys. Use email instead.'
      handle.update()
    })

    async function signIn() {
      busy = true
      message = ''
      let signal = await handle.update()
      try {
        let response = await fetch(handle.props.optionsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ next: handle.props.next ?? null }),
          signal,
        })
        if (signal.aborted) return
        if (!response.ok) throw new Error(String(response.status))
        // TODO(auth): navigator.credentials.get(options) → verify → redirect to next.
        message = 'Passkeys aren’t switched on yet. Use email for now.'
      } catch {
        if (signal.aborted) return
        message = 'Passkeys aren’t switched on yet. Use email for now.'
      }
      busy = false
      handle.update()
    }

    return () => (
      <div mix={wrapStyle}>
        <ProviderButton icon="key" disabled={!ready || busy} busy={busy} mix={on('click', signIn)}>
          {busy ? 'Waiting for your passkey…' : 'Use a passkey'}
        </ProviderButton>
        <p role="status" mix={messageStyle}>
          {message}
        </p>
      </div>
    )
  },
)

const wrapStyle = css({ display: 'flex', flexDirection: 'column' })
const messageStyle = css({
  margin: 0,
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
  color: 'var(--warn)',
  '&:not(:empty)': { marginTop: 'var(--space-2)' },
})
