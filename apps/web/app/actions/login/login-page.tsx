import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../routes.ts'
import { FormField } from '../../ui/form-field.tsx'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'
import { issueFor, type FormIssue, type LoginMode } from './schema.ts'

export interface LoginPageProps {
  mode: LoginMode
  next?: string
  values?: { email?: string; displayName?: string }
  issues?: readonly FormIssue[]
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { mode, next, values = {}, issues } = handle.props
    let signup = mode === 'signup'
    let otherMode = signup ? undefined : 'signup'
    let switchHref = routes.login.index.href(undefined, {
      searchParams: { ...(otherMode ? { mode: otherMode } : {}), ...(next ? { next } : {}) },
    })

    return (
      <PlaceholderPage
        title={signup ? 'Create your account' : 'Sign in'}
        pattern="/login"
        artboard="Auth"
        summary="Passkey first, then GitHub, Google, or an email link with a 6-digit code. The form below posts to a stub that writes nothing."
        currentPath={routes.login.index.href()}
      >
        <form method="post" action={routes.login.action.href()} mix={formStyle} noValidate>
          {issues?.length ? (
            <p role="alert" mix={alertStyle}>
              Please correct the fields below.
            </p>
          ) : null}
          <input type="hidden" name="mode" value={mode} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {signup ? (
            <FormField
              name="displayName"
              label="Your name"
              value={values.displayName}
              error={issueFor(issues, 'displayName')?.message}
              autoComplete="name"
              maxLength={60}
            />
          ) : null}
          <FormField
            name="email"
            label="Email"
            type="email"
            value={values.email}
            error={issueFor(issues, 'email')?.message}
            hint="We’ll email you a link and a 6-digit code."
            autoComplete="email webauthn"
            inputMode="email"
            required
          />
          <Keycap type="submit" size="lg">
            {signup ? 'Create account' : 'Email me a code'}
          </Keycap>
          <p mix={switchStyle}>
            {signup ? 'Already have an account? ' : 'New to bits? '}
            <a href={switchHref}>{signup ? 'Sign in' : 'Create an account'}</a>
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
  maxWidth: '420px',
  marginTop: 'var(--space-4)',
})

const alertStyle = css({ color: 'var(--danger)' })

const switchStyle = css({ color: 'var(--muted)', fontSize: 'var(--type-ui-size)' })
