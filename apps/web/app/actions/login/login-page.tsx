import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Callout } from '@bits/ui/callout'
import { ProviderButton } from '@bits/ui/provider-button'
import { TextField } from '@bits/ui/text-field'

import { isPreview, oauthCredentials } from '../../auth/config.ts'
import { routes } from '../../routes.ts'
import { PasskeyButton } from './public/passkey-button.tsx'
import { PendingSubmit } from '@bits/ui/pending-submit'
import { TimezoneField } from './public/timezone-field.tsx'
import { issueFor, type FormIssue } from './schema.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from './ui/auth-shell.tsx'

export interface LoginNotice {
  tone: 'ok' | 'warning' | 'danger'
  text: string
}

export interface LoginPageProps {
  next?: string
  values?: { email?: string }
  issues?: readonly FormIssue[]
  /** A message above the providers: OAuth errors, rate limits, sign-out confirmations. */
  notice?: LoginNotice
  /** A passkey this site doesn't know (decision 030): the island signals it to the browser. */
  unknownPasskey?: { rpId: string; credentialId: string }
}

/**
 * `/login` (Auth spec, state A; decision 065): one passwordless flow. The
 * same email code signs a returning learner in or, for a new address,
 * creates the account; there is no separate sign-up form.
 */
export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { next, values = {}, issues, notice, unknownPasskey } = handle.props
    // Workers Previews (decision 038): no OAuth (the apps' callbacks are
    // production's and previews get no client secrets) and no mail.
    let preview = isPreview()
    // Only the providers that are set up: an unconfigured one is a dead end.
    let github = !preview && oauthCredentials('github') !== null
    let google = !preview && oauthCredentials('google') !== null
    let nextParam = next ? { next } : {}
    let emailError = issueFor(issues, 'email')?.message

    return (
      <AuthShell title="Sign in" next={next}>
        <div mix={[riseStyle, blockStyle]}>
          <div data-rmx-key="heading" mix={headingGroupStyle}>
            <h1 mix={formHeadingStyle}>Sign in or sign up.</h1>
            <p mix={subStyle}>
              One email, no password. New here? Your free account is made when you enter the code.
            </p>
          </div>

          {notice ? (
            <Callout tone={notice.tone} role={notice.tone === 'ok' ? 'status' : 'alert'} compact>
              {notice.text}
            </Callout>
          ) : null}

          <div data-rmx-key="providers" mix={providersStyle}>
            <PasskeyButton
              optionsUrl={routes.api.passkey.href({ step: 'login-options' })}
              action={routes.login.passkey.href()}
              next={next}
              unknownCredential={unknownPasskey}
            />
            {github ? (
              <ProviderButton icon="github" href={routes.auth.oauth.start.href({ provider: 'github' }, { searchParams: nextParam })}>
                Continue with GitHub
              </ProviderButton>
            ) : null}
            {google ? (
              <ProviderButton icon="globe" href={routes.auth.oauth.start.href({ provider: 'google' }, { searchParams: nextParam })}>
                Continue with Google
              </ProviderButton>
            ) : null}
          </div>

          <div data-rmx-key="divider" mix={dividerStyle}>
            <span aria-hidden="true" mix={ruleStyle} />
            or use email
            <span aria-hidden="true" mix={ruleStyle} />
          </div>

          <form data-rmx-key="email-form" method="post" action={routes.login.action.href()} mix={formStyle} noValidate>
            {issues?.length ? (
              <Callout tone="danger" role="alert" compact>
                {issues.length === 1 ? 'Check the highlighted field.' : 'Check the highlighted fields.'}
              </Callout>
            ) : null}
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <div data-rmx-key="email" mix={slotStyle}>
              <TextField
                id="auth-email"
                name="email"
                label="Email"
                type="email"
                placeholder="you@somewhere.dev"
                value={values.email}
                error={emailError}
                autoComplete="email webauthn"
                inputMode="email"
                enterKeyHint="send"
                required
                mono
                autoFocus={Boolean(emailError)}
              />
            </div>
            {/* A new account's time zone, for streak days; ignored when the address has one. */}
            <div data-rmx-key="timezone" mix={slotStyle}>
              <TimezoneField />
            </div>
            <div data-rmx-key="submit" mix={submitWrapStyle}>
              <PendingSubmit
                label={preview ? 'Get a sign-in code →' : 'Email me a sign-in link →'}
                pendingLabel={preview ? 'Working…' : 'Sending…'}
                block
              />
            </div>
            {/* The terms line is the shell footer's, shared with the code step. */}
            <p data-rmx-key="note" mix={noteStyle}>
              {preview
                ? 'No passwords. Mail is off on this preview, so the one-time code is shown on the next page.'
                : "No passwords. We'll email you a one-time link and code."}
            </p>
          </form>
        </div>
      </AuthShell>
    )
  }
}

const blockStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5_5)' })

// One stack of keys that share their hairlines (decision 047): no gaps.
const providersStyle = css({
  display: 'flex',
  flexDirection: 'column',
  '& > * + *': { marginTop: 'calc(-1 * var(--border-w))' },
  '& > *:hover, & > *:focus-visible': { position: 'relative', zIndex: 1 },
})

const dividerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})

const ruleStyle = css({ flex: 1, height: 'var(--border-w)', background: 'var(--line-cell)' })

const formStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })

const submitWrapStyle = css({ marginTop: 'var(--space-1)', display: 'flex' })

/** A keyed wrapper that adds no box: the field lays out as the form's own child. */
const slotStyle = css({ display: 'contents' })

const noteStyle = css({
  margin: 0,
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
  color: 'var(--dim)',
  textAlign: 'center',
})
