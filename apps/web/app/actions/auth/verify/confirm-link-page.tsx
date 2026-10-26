import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Icon } from '@bits/ui/icon'

import { routes } from '../../../routes.ts'
import { PendingSubmit } from '../../login/public/pending-submit.tsx'
import { AuthShell, formHeadingStyle, headingGroupStyle, riseStyle, subStyle } from '../../login/ui/auth-shell.tsx'

export interface ConfirmLinkPageProps {
  token: string
  email: string
}

/**
 * GET /auth/verify?token=: one click to finish signing in. The link itself
 * never signs anyone in, because mail scanners open links before people do
 * and would spend the single-use token (decision 015). The POST does.
 */
export function ConfirmLinkPage(handle: Handle<ConfirmLinkPageProps>) {
  return () => {
    let { token, email } = handle.props
    return (
      <AuthShell title="Finish signing in" mode="signin">
        <div mix={[riseStyle, blockStyle]}>
          <div aria-hidden="true" mix={tileStyle}>
            <Icon name="key" />
          </div>
          <div mix={headingGroupStyle}>
            <h1 mix={formHeadingStyle}>One more click.</h1>
            <p mix={subStyle}>
              Sign in as <span mix={emailStyle}>{email}</span>.
            </p>
          </div>
          <form method="post" action={routes.auth.verify.action.href()}>
            <input type="hidden" name="token" value={token} />
            <PendingSubmit label="Continue to Bits →" pendingLabel="Signing in…" block />
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
