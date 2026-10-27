import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Icon } from '@bits/ui/icon'
import { PendingSubmit } from '@bits/ui/pending-submit'

import { routes } from '../../../routes.ts'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from '../../login/ui/auth-shell.tsx'

export interface ConfirmEmailPageProps {
  token: string
  email: string
}

/**
 * GET /auth/email?token=: confirm a new sign-in email with one click. Like
 * the magic link (decision 015), the GET only looks; mail scanners open
 * links, so only the POST spends the token (decision 030).
 */
export function ConfirmEmailPage(handle: Handle<ConfirmEmailPageProps>) {
  return () => {
    let { token, email } = handle.props
    return (
      <AuthShell title="Confirm your new email" mode="signin">
        <div mix={[riseStyle, blockStyle]}>
          <div aria-hidden="true" mix={tileStyle}>
            <Icon name="mail" />
          </div>
          <div mix={headingGroupStyle}>
            <h1 mix={formHeadingStyle}>New email?</h1>
            <p mix={subStyle}>
              Make <span mix={emailStyle}>{email}</span> your sign-in email. Your other devices will be signed out.
            </p>
          </div>
          <form method="post" action={routes.auth.email.action.href()}>
            <input type="hidden" name="token" value={token} />
            <PendingSubmit label="Confirm new email →" pendingLabel="Confirming…" block />
          </form>
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

const emailStyle = css({ color: 'var(--text)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })
