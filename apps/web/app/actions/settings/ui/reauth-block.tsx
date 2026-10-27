import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../../routes.ts'
import { PasskeyButton } from '../../login/public/passkey-button.tsx'

/**
 * Step-up (decision 030): changing the email or adding a passkey needs a
 * sign-in from the last 10 minutes. Older sessions confirm it's them with a
 * code to the current address (POST /settings/reauth → /login/check) or a
 * passkey (/login/passkey), and come back here.
 */
export function ReauthBlock(handle: Handle<{ what: string; email: string }>) {
  return () => {
    let { what, email } = handle.props
    let next = routes.settings.index.href()
    return (
      <div mix={blockStyle}>
        <p mix={textStyle}>
          To {what}, confirm it’s you first. We’ll email a code to <span mix={emailStyle}>{email}</span>, or use a
          passkey.
        </p>
        <div mix={actionsStyle}>
          <form method="post" action={routes.settings.reauth.href()}>
            <Keycap type="submit" variant="dark" mix={keyStyle}>
              Email me a code
            </Keycap>
          </form>
          <div mix={passkeyStyle}>
            <PasskeyButton
              optionsUrl={routes.api.passkey.href({ step: 'login-options' })}
              action={routes.login.passkey.href()}
              next={next}
              autofill={false}
            />
          </div>
        </div>
      </div>
    )
  }
}

const blockStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-12)',
  border: '1px dashed var(--line-strong)',
})

const textStyle = css({ margin: 0, fontSize: 'var(--fs-15)', lineHeight: 1.55, color: 'var(--text-body)' })

const emailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  '@media (max-width: 480px)': { flexDirection: 'column', alignItems: 'stretch' },
})

const keyStyle = css({ '@media (max-width: 480px)': { width: '100%' } })

const passkeyStyle = css({ flex: '1 1 220px', minWidth: 0 })
