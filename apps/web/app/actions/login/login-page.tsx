import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Callout } from '@bits/ui/callout'
import { ChoiceChip } from '@bits/ui/chip'
import { ProviderButton } from '@bits/ui/provider-button'
import { TextField } from '@bits/ui/text-field'

import { routes } from '../../routes.ts'
import { PasskeyButton } from './public/passkey-button.tsx'
import { PendingSubmit } from '@bits/ui/pending-submit'
import { TimezoneField } from './public/timezone-field.tsx'
import { issueFor, signupGoals, type FormIssue, type LoginMode, type SignupGoal } from './schema.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from './ui/auth-shell.tsx'

export interface LoginNotice {
  tone: 'ok' | 'warning' | 'danger'
  text: string
}

export interface LoginPageProps {
  mode: LoginMode
  next?: string
  values?: { email?: string; displayName?: string; goals?: readonly SignupGoal[] }
  issues?: readonly FormIssue[]
  /** A message above the providers: OAuth errors, rate limits, sign-out confirmations. */
  notice?: LoginNotice
  /** A passkey this site doesn't know (decision 030): the island signals it to the browser. */
  unknownPasskey?: { rpId: string; credentialId: string }
}

const copy = {
  signin: {
    title: 'Sign in',
    heading: 'Welcome back.',
    sub: 'Pick up exactly where you left off — mid-lesson, mid-prompt.',
    cta: 'Email me a sign-in link →',
  },
  signup: {
    title: 'Create account',
    heading: 'Make it yours.',
    sub: 'Free forever. Save your progress, streaks and every prompt you write.',
    cta: 'Create account →',
  },
} as const

/** `/login` and `/login?mode=signup` (Auth spec, states A and B). */
export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { mode, next, values = {}, issues, notice, unknownPasskey } = handle.props
    let signup = mode === 'signup'
    let text = copy[mode]
    let nextParam = next ? { next } : {}
    let nameError = issueFor(issues, 'displayName')?.message
    let emailError = issueFor(issues, 'email')?.message
    let goals = values.goals ?? (issues ? [] : ['curious'])

    return (
      <AuthShell title={text.title} mode={mode} next={next}>
        <div mix={[riseStyle, blockStyle]}>
          <div mix={headingGroupStyle}>
            <h1 mix={formHeadingStyle}>{text.heading}</h1>
            <p mix={subStyle}>{text.sub}</p>
          </div>

          {notice ? (
            <Callout tone={notice.tone} role={notice.tone === 'ok' ? 'status' : 'alert'} compact>
              {notice.text}
            </Callout>
          ) : null}

          <div mix={providersStyle}>
            <PasskeyButton
              optionsUrl={routes.api.passkey.href({ step: 'login-options' })}
              action={routes.login.passkey.href()}
              next={next}
              unknownCredential={unknownPasskey}
            />
            <ProviderButton
              icon="github"
              href={routes.auth.oauth.start.href({ provider: 'github' }, { searchParams: nextParam })}
            >
              Continue with GitHub
            </ProviderButton>
            <ProviderButton
              icon="globe"
              href={routes.auth.oauth.start.href({ provider: 'google' }, { searchParams: nextParam })}
            >
              Continue with Google
            </ProviderButton>
          </div>

          <div mix={dividerStyle}>
            <span aria-hidden="true" mix={ruleStyle} />
            or use email
            <span aria-hidden="true" mix={ruleStyle} />
          </div>

          <form method="post" action={routes.login.action.href()} mix={formStyle} noValidate>
            {issues?.length ? (
              <Callout tone="danger" role="alert" compact>
                {issues.length === 1 ? 'Check the highlighted field.' : 'Check the highlighted fields.'}
              </Callout>
            ) : null}
            <input type="hidden" name="mode" value={mode} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {signup ? (
              <TextField
                id="auth-name"
                name="displayName"
                label="What should we call you?"
                placeholder="Ada"
                value={values.displayName}
                error={nameError}
                autoComplete="name"
                enterKeyHint="next"
                maxLength={60}
                autoFocus={Boolean(nameError)}
              />
            ) : null}
            <TextField
              id="auth-email"
              name="email"
              label="Email"
              type="email"
              placeholder="you@somewhere.dev"
              value={values.email}
              error={emailError}
              autoComplete={signup ? 'email' : 'email webauthn'}
              inputMode="email"
              enterKeyHint={signup ? 'next' : 'send'}
              required
              mono
              autoFocus={Boolean(emailError) && !nameError}
            />
            {signup ? (
              <fieldset mix={goalsFieldsetStyle}>
                <legend mix={legendStyle}>
                  What brings you here? <span mix={legendHintStyle}>— we'll suggest a first course</span>
                </legend>
                <div mix={chipsStyle}>
                  {signupGoals.map((goal) => (
                    <ChoiceChip
                      key={goal.id}
                      name="goals"
                      value={goal.id}
                      defaultChecked={goals.includes(goal.id)}
                      mix={chipStyle}
                    >
                      {goal.label}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {signup ? <TimezoneField /> : null}
            <div mix={submitWrapStyle}>
              <PendingSubmit label={text.cta} pendingLabel="Sending…" block />
            </div>
            <p mix={noteStyle}>No passwords. We'll email you a one-time link and code.</p>
            <p mix={noteStyle}>
              By continuing you agree to the <a href={routes.legal.terms.href()} mix={legalLinkStyle}>Terms</a> and{' '}
              <a href={routes.legal.privacy.href()} mix={legalLinkStyle}>Privacy</a> policy.
            </p>
          </form>
        </div>
      </AuthShell>
    )
  }
}

const blockStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5_5)' })

const providersStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-2_5)' })

const dividerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3_5)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--dim)',
})

const ruleStyle = css({ flex: 1, height: '1px', background: 'var(--line)' })

const formStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' })

const goalsFieldsetStyle = css({
  margin: 0,
  padding: 0,
  border: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2_5)',
})

const legendStyle = css({
  padding: 0,
  marginBottom: 'var(--space-2_5)',
  fontSize: 'var(--fs-14)',
  color: 'var(--text-body)',
})

const legendHintStyle = css({ color: 'var(--dim)' })

const chipsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })

// Two chips per row on phones (Auth spec, responsive).
const chipStyle = css({
  '@media (max-width: 480px)': { flex: '1 1 calc(50% - var(--space-1))', justifyContent: 'center' },
})

const submitWrapStyle = css({ marginTop: 'var(--space-1)', display: 'flex' })

const legalLinkStyle = css({ color: 'var(--muted)', '&:hover': { color: 'var(--text)' } })

const noteStyle = css({
  margin: 0,
  fontSize: 'var(--fs-13)',
  lineHeight: 1.5,
  color: 'var(--dim)',
  textAlign: 'center',
})
