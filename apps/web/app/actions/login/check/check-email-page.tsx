import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Callout } from '@bits/ui/callout'
import { CodeInput } from '@bits/ui/code-input'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'

import { isPreview } from '../../../auth/config.ts'
import { routes } from '../../../routes.ts'
import { PendingSubmit } from '@bits/ui/pending-submit'
import { issueFor, type FormIssue, type LoginMode } from '../schema.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from '../ui/auth-shell.tsx'

export interface CheckEmailPageProps {
  email: string
  mode?: LoginMode
  next?: string
  code?: string
  /** On a Workers Preview, the code POST /login flashed for this browser (decision 038). */
  previewCode?: string
  issues?: readonly FormIssue[]
  /** "Send again" posts to /login, so it carries its own bot check. */
}

/**
 * "Check your inbox" (Auth spec, state C). Shared by GET /login/check and an
 * invalid POST /auth/verify.
 */
export function CheckEmailPage(handle: Handle<CheckEmailPageProps>) {
  return () => {
    let { email, mode = 'signin', next, code, previewCode, issues } = handle.props
    let nextParam = next ? { next } : {}
    let error = issueFor(issues, 'code')?.message ?? issueFor(issues, 'email')?.message
    // A Workers Preview sends no mail: the code is on this page instead.
    let preview = isPreview()

    return (
      <AuthShell title={preview ? 'Your sign-in code' : 'Check your inbox'} mode={mode} next={next}>
        <div mix={[riseStyle, blockStyle]}>
          <div aria-hidden="true" mix={tileStyle}>
            <Icon name="mail" />
          </div>
          <div mix={headingGroupStyle}>
            <h1 mix={[formHeadingStyle, checkHeadingStyle]}>{preview ? 'Enter your code.' : 'Check your inbox.'}</h1>
            {preview ? (
              <p mix={subStyle}>
                Mail is off on this preview, so the code for <span mix={emailStyle}>{email || 'your email'}</span>{' '}
                is shown here instead of emailed.
              </p>
            ) : (
              <p mix={subStyle}>
                We sent a sign-in link to <span mix={emailStyle}>{email || 'your email'}</span>. Or type the 6-digit
                code from the email:
              </p>
            )}
          </div>

          {preview ? (
            <Callout tone="info" compact>
              {previewCode ? (
                <span>
                  Preview sign-in code: <span mix={previewCodeStyle}>{previewCode}</span> (filled in below). Anyone can
                  sign in to any address on a preview, so use a made-up one.
                </span>
              ) : (
                'The code is shown once, right after you ask for it. Use “Send again” for a new one.'
              )}
            </Callout>
          ) : null}

          <form method="post" action={routes.auth.verify.action.href()} mix={formStyle} noValidate>
            <input type="hidden" name="email" value={email} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {/* The page exists to take this code: focus it (and again after a wrong one). */}
            <CodeInput name="code" label="6-digit code" value={code ?? previewCode} error={error} autoSubmit autoFocus />
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
  width: '56px',
  height: '56px',
  color: 'var(--volt)',
  background: 'var(--volt-tint)',
  border: 'var(--border-w) solid var(--volt-edge)',
  display: 'grid',
  placeItems: 'center',
})

const checkHeadingStyle = css({ fontSize: 'var(--fs-32)', '@media (max-width: 380px)': { fontSize: 'var(--fs-28)' } })

const previewCodeStyle = css({ fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' })

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
  '&:focus-visible': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset)' },
  // While the resend is in flight (the navigation runtime sets aria-busy).
  '&[aria-busy="true"]': { cursor: 'progress', color: 'var(--muted)', textDecoration: 'none' },
  '&[aria-busy="true"]::after': { content: '" …" / ""' },
})
