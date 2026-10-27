import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { CodeInput } from '@bits/ui/code-input'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'

import { routes } from '../../../routes.ts'
import { PendingSubmit } from '@bits/ui/pending-submit'
import { issueFor, type FormIssue, type LoginMode } from '../schema.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from '../ui/auth-shell.tsx'

export interface CheckEmailPageProps {
  email: string
  mode?: LoginMode
  next?: string
  code?: string
  issues?: readonly FormIssue[]
  /** "Send again" posts to /login, so it carries its own bot check. */
}

/**
 * "Check your inbox" (Auth spec, state C). Shared by GET /login/check and an
 * invalid POST /auth/verify.
 */
export function CheckEmailPage(handle: Handle<CheckEmailPageProps>) {
  return () => {
    let { email, mode = 'signin', next, code, issues } = handle.props
    let nextParam = next ? { next } : {}
    let error = issueFor(issues, 'code')?.message ?? issueFor(issues, 'email')?.message

    return (
      <AuthShell title="Check your inbox" mode={mode} next={next}>
        <div mix={[riseStyle, blockStyle]}>
          <div aria-hidden="true" mix={tileStyle}>
            <Icon name="mail" />
          </div>
          <div mix={headingGroupStyle}>
            <h1 mix={[formHeadingStyle, checkHeadingStyle]}>Check your inbox.</h1>
            <p mix={subStyle}>
              We sent a sign-in link to <span mix={emailStyle}>{email || 'your email'}</span>. Or type the 6-digit
              code from the email:
            </p>
          </div>

          <form method="post" action={routes.auth.verify.action.href()} mix={formStyle} noValidate>
            <input type="hidden" name="email" value={email} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {/* The page exists to take this code: focus it (and again after a wrong one). */}
            <CodeInput name="code" label="6-digit code" value={code} error={error} autoSubmit autoFocus />
            <div mix={actionsStyle}>
              <PendingSubmit label="Verify & continue" pendingLabel="Verifying…" grow />
              <Keycap
                variant="ghost-mono"
                size="lg"
                href={routes.login.index.href(undefined, {
                  searchParams: { ...(mode === 'signup' ? { mode } : {}), ...nextParam },
                })}
                mix={secondaryStyle}
              >
                Use another email
              </Keycap>
            </div>
          </form>

          {email ? (
            <form method="post" action={routes.login.action.href()} mix={resendStyle}>
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="mode" value={mode} />
              {next ? <input type="hidden" name="next" value={next} /> : null}
              Didn't get it?{' '}
              <button type="submit" mix={linkButtonStyle}>
                Send again
              </button>
            </form>
          ) : null}
        </div>
      </AuthShell>
    )
  }
}

const blockStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5_5)' })

const tileStyle = css({
  width: '64px',
  height: '64px',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--volt-tint)',
  border: '1px solid var(--volt-a40)',
  display: 'grid',
  placeItems: 'center',
})

const checkHeadingStyle = css({ fontSize: 'var(--fs-32)', '@media (max-width: 380px)': { fontSize: 'var(--fs-28)' } })

const emailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5_5)',
  // Code boxes 60 → 56px on phones (Auth spec, responsive).
  '@media (max-width: 480px)': { '& input[inputmode="numeric"]': { height: '56px' } },
})

const actionsStyle = css({
  display: 'flex',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
  '@media (max-width: 480px)': { '& > *': { flex: '1 1 100%' } },
})

const secondaryStyle = css({ padding: '0 var(--space-4_5)' })

const resendStyle = css({ margin: 0, fontSize: 'var(--fs-13)', lineHeight: 1.5, color: 'var(--dim)' })

const linkButtonStyle = css({
  display: 'inline',
  padding: 0,
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'var(--volt)',
  textDecoration: 'underline',
  cursor: 'pointer',
  // 44px hit area around the inline link (resolutions §7).
  position: 'relative',
  '&::before': { content: '""', position: 'absolute', inset: '-14px -6px' },
  '&:hover': { color: 'var(--volt-link-hover)' },
  '&:focus-visible': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
  // While the resend is in flight (the navigation runtime sets aria-busy).
  '&[aria-busy="true"]': { cursor: 'progress', color: 'var(--muted)', textDecoration: 'none' },
  '&[aria-busy="true"]::after': { content: '" …" / ""' },
})
