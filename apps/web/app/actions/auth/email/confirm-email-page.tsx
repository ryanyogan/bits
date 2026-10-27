import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Icon } from '@bits/ui/icon'
import { Keycap } from '@bits/ui/keycap'
import { PendingSubmit } from '@bits/ui/pending-submit'

import { routes } from '../../../routes.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from '../../login/ui/auth-shell.tsx'

export type EmailLinkPageProps =
  /** The account's own session: one click confirms the new email. */
  | { kind: 'confirm'; token: string; email: string }
  /** Anyone else: sign in to the account first (a link never signs anyone in). `account` is masked. */
  | { kind: 'sign-in-first'; email: string; account: string }
  /** The old address undoing a change (7-day link). */
  | { kind: 'revert'; token: string; email: string }

/**
 * GET /auth/email?token= and /auth/email/revert?token= (decision 030). Like
 * the magic link (decision 015), a GET only looks; mail scanners open
 * links, so only the POST acts.
 */
export function EmailLinkPage(handle: Handle<EmailLinkPageProps>) {
  return () => {
    let props = handle.props
    return (
      <AuthShell title={titles[props.kind]} mode="signin">
        <div mix={[riseStyle, blockStyle]}>
          <div aria-hidden="true" mix={tileStyle}>
            <Icon name="mail" />
          </div>
          {props.kind === 'confirm' ? (
            <>
              <div mix={headingGroupStyle}>
                <h1 mix={formHeadingStyle}>New email?</h1>
                <p mix={subStyle}>
                  Make <span mix={emailStyle}>{props.email}</span> your sign-in email.
                </p>
              </div>
              <form method="post" action={routes.auth.email.action.href()}>
                <input type="hidden" name="token" value={props.token} />
                <PendingSubmit label="Confirm new email →" pendingLabel="Confirming…" block />
              </form>
            </>
          ) : props.kind === 'sign-in-first' ? (
            <>
              <div mix={headingGroupStyle}>
                <h1 mix={formHeadingStyle}>Sign in first.</h1>
                <p mix={subStyle}>
                  This link moves a Bits account (<span mix={emailStyle}>{props.account}</span>) to{' '}
                  <span mix={emailStyle}>{props.email}</span>. Only the account that asked for this change can confirm
                  it: sign in to it on this device, then type the code from the email in Settings.
                </p>
              </div>
              <Keycap
                href={routes.login.index.href(undefined, { searchParams: { next: routes.settings.index.href() } })}
                block
              >
                Sign in →
              </Keycap>
            </>
          ) : (
            <>
              <div mix={headingGroupStyle}>
                <h1 mix={formHeadingStyle}>Undo the change?</h1>
                <p mix={subStyle}>
                  This puts <span mix={emailStyle}>{props.email}</span> back as the sign-in email, signs out every
                  device and removes passkeys and GitHub or Google sign-ins added since the day before the change.
                  Then sign in again.
                </p>
              </div>
              <form method="post" action={routes.auth.emailRevert.action.href()}>
                <input type="hidden" name="token" value={props.token} />
                <PendingSubmit label="Undo the change →" pendingLabel="Undoing…" block />
              </form>
            </>
          )}
        </div>
      </AuthShell>
    )
  }
}

const titles = {
  confirm: 'Confirm your new email',
  'sign-in-first': 'Sign in to confirm',
  revert: 'Undo the email change',
} as const

const blockStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-5_5)' })

const tileStyle = css({
  width: '64px',
  height: '64px',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--volt-tint)',
  border: 'var(--border-w) solid var(--volt-a40)',
  display: 'grid',
  placeItems: 'center',
})

const emailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })
