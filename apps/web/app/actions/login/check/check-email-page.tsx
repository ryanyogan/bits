import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../../routes.ts'
import { FormField } from '../../../ui/form-field.tsx'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'
import { issueFor, type FormIssue } from '../schema.ts'

export interface CheckEmailPageProps {
  email: string
  code?: string
  issues?: readonly FormIssue[]
}

/** Shared by GET /login/check and an invalid POST /auth/verify. */
export function CheckEmailPage(handle: Handle<CheckEmailPageProps>) {
  return () => {
    let { email, code, issues } = handle.props

    return (
      <PlaceholderPage
        title="Check your email"
        pattern="/login/check"
        artboard="Auth"
        summary={
          email
            ? `We sent a sign-in link and a 6-digit code to ${email}. Open the link on this device, or type the code.`
            : 'We sent a sign-in link and a 6-digit code. Open the link on this device, or type the code.'
        }
        currentPath={routes.login.index.href()}
      >
        <form method="post" action={routes.auth.verify.action.href()} mix={formStyle} noValidate>
          <input type="hidden" name="email" value={email} />
          <FormField
            name="code"
            label="6-digit code"
            value={code}
            error={issueFor(issues, 'code')?.message ?? issueFor(issues, 'email')?.message}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
          />
          <Keycap type="submit" size="lg">
            Verify
          </Keycap>
          <p mix={mutedStyle}>
            Wrong address? <a href={routes.login.index.href()}>Start over</a>
          </p>
        </form>
      </PlaceholderPage>
    )
  }
}

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  maxWidth: '320px',
  marginTop: 'var(--space-4)',
})

const mutedStyle = css({ color: 'var(--muted)', fontSize: 'var(--type-ui-size)' })
