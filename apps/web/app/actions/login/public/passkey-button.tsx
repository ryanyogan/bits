import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  sendSignal,
  startAuthentication,
  WebAuthnAbortService,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { ProviderButton } from '@bits/ui/provider-button'

export interface PasskeyButtonProps {
  /** `POST /api/passkey/login-options`: a fresh challenge (JSON). */
  optionsUrl: string
  /** `POST /login/passkey`: where the browser's answer goes, as a form. */
  action: string
  next?: string
  /**
   * The credential the server just didn't recognise (removed in Settings but
   * still on the device). Signalled to the browser so it can drop it.
   */
  unknownCredential?: { rpId: string; credentialId: string }
}

/**
 * "Use a passkey" (Auth spec, providers; decision 030). WebAuthn needs JS, so
 * without it the button is hidden (`scripting: none`); the server renders it
 * disabled and the browser enables it, or removes it when the browser has no
 * WebAuthn. Where the browser supports passkey autofill, a conditional
 * request also starts on load, so the email field's autofill offers
 * passkeys (`autocomplete="email webauthn"`). Either way the signed answer
 * goes back as a native form POST, so the sign-in is an ordinary navigation.
 */
export const PasskeyButton = clientEntry(
  import.meta.url,
  function PasskeyButton(handle: Handle<PasskeyButtonProps>) {
    let support: 'unknown' | 'yes' | 'no' = 'unknown'
    let busy = false
    let message = ''
    let form: HTMLFormElement | undefined
    let field: HTMLInputElement | undefined

    handle.signal.addEventListener('abort', () => WebAuthnAbortService.cancelCeremony())

    handle.queueTask(async () => {
      support = browserSupportsWebAuthn() ? 'yes' : 'no'
      handle.update()
      if (support === 'no') return
      let unknown = handle.props.unknownCredential
      // Signal API, where supported; best effort.
      if (unknown) {
        sendSignal({ signalName: 'unknownCredential', rpID: unknown.rpId, credentialID: unknown.credentialId }).catch(
          () => {},
        )
      }
      if (await browserSupportsWebAuthnAutofill()) void autofill()
    })

    async function options(): Promise<PublicKeyCredentialRequestOptionsJSON> {
      let response = await fetch(handle.props.optionsUrl, { method: 'POST' })
      if (!response.ok) throw new Error(String(response.status))
      return response.json()
    }

    function submit(result: AuthenticationResponseJSON) {
      if (!form || !field) return
      field.value = JSON.stringify(result)
      form.requestSubmit()
    }

    // Conditional mediation: stays pending until the learner picks a passkey
    // in the email field's autofill. Clicking the button aborts it.
    async function autofill() {
      try {
        let optionsJSON = await options()
        if (handle.signal.aborted || busy) return
        submit(await startAuthentication({ optionsJSON, useBrowserAutofill: true }))
      } catch {
        // Aborted by the button, or no autofill after all: the button still works.
      }
    }

    async function signIn() {
      if (busy) return
      busy = true
      message = ''
      handle.update()
      try {
        let optionsJSON = await options()
        submit(await startAuthentication({ optionsJSON }))
        // Leave the button busy: the form navigation takes over.
        return
      } catch (error) {
        if (handle.signal.aborted) return
        message =
          (error as Error)?.name === 'NotAllowedError'
            ? 'No passkey was used. Try again, or use email.'
            : 'Passkey sign-in didn’t work here. Use email instead.'
      }
      busy = false
      handle.update()
    }

    return () => {
      if (support === 'no') return null
      let { action, next } = handle.props
      return (
        <div mix={wrapStyle}>
          <ProviderButton icon="key" disabled={support !== 'yes'} busy={busy} mix={on('click', signIn)}>
            {busy ? 'Waiting for your passkey…' : 'Use a passkey'}
          </ProviderButton>
          <p role="status" mix={messageStyle}>
            {message}
          </p>
          <form method="post" action={action} hidden mix={ref((node) => (form = node as HTMLFormElement))}>
            <input type="hidden" name="response" mix={ref((node) => (field = node as HTMLInputElement))} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
          </form>
        </div>
      )
    }
  },
)

const wrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  // Without JS there is no WebAuthn: don't show a button that can't work.
  '@media (scripting: none)': { display: 'none' },
})
const messageStyle = css({
  margin: 0,
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
  color: 'var(--warn)',
  '&:not(:empty)': { marginTop: 'var(--space-2)' },
})
