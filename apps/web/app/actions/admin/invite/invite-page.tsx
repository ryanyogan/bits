import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Card } from '@bits/ui/card'
import { Eyebrow } from '@bits/ui/eyebrow'
import { Keycap } from '@bits/ui/keycap'
import { PendingSubmit } from '@bits/ui/pending-submit'

import type { Viewer } from '../../../auth/identity.ts'
import { APP_NAME } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export type InvitePageProps =
  /** Signed in as the invited address: one click accepts. */
  | { kind: 'accept'; viewer: Viewer; token: string; from: string | null; courses: string[] }
  /** Signed in as someone else. `invited` is masked. */
  | { kind: 'wrong-account'; viewer: Viewer; invited: string }
  /** Unknown, expired, used or withdrawn. */
  | { kind: 'expired'; viewer: Viewer | null }

/**
 * GET /admin/invite?token= (decision 037). Like the other emailed links, a
 * GET only looks (mail scanners open links); only the POST accepts.
 */
export function InvitePage(handle: Handle<InvitePageProps>) {
  return () => {
    let props = handle.props
    return (
      <Layout title={titles[props.kind]} viewer={props.viewer} bleed>
        <div mix={pageStyle}>
          <Card variant="page" mix={cardStyle}>
            <Eyebrow as="p">Author invite</Eyebrow>
            {props.kind === 'accept' ? (
              <>
                <h1 mix={headingStyle}>Write courses on {APP_NAME}?</h1>
                <p mix={leadStyle}>
                  {props.from ? <>@{props.from} invited you to be an author. </> : <>You’re invited to be an author. </>}
                  {props.courses.length ? (
                    <>
                      You’ll join <strong>{props.courses.join(', ')}</strong>.
                    </>
                  ) : (
                    <>You can upload and publish your own courses.</>
                  )}
                </p>
                <form method="post" action={routes.admin.invite.action.href()}>
                  <input type="hidden" name="token" value={props.token} />
                  <PendingSubmit label="Accept the invite →" pendingLabel="Accepting…" block />
                </form>
              </>
            ) : props.kind === 'wrong-account' ? (
              <>
                <h1 mix={headingStyle}>This invite is for someone else.</h1>
                <p mix={leadStyle}>
                  It was sent to <span mix={monoStyle}>{props.invited}</span>, and you’re signed in as{' '}
                  <span mix={monoStyle}>{props.viewer.email}</span>. Sign out, open the link from the email again and
                  sign in with the address it was sent to.
                </p>
                <form method="post" action={routes.logout.action.href()}>
                  <Keycap type="submit" variant="dark" block>
                    Sign out
                  </Keycap>
                </form>
              </>
            ) : (
              <>
                <h1 mix={headingStyle}>This invite has expired.</h1>
                <p mix={leadStyle}>
                  It was already used, withdrawn, or is more than 7 days old. Ask the admin who invited you for a new
                  one.
                </p>
                <Keycap href={routes.home.href()} variant="dark" block>
                  Back to {APP_NAME}
                </Keycap>
              </>
            )}
          </Card>
        </div>
      </Layout>
    )
  }
}

const titles = {
  accept: 'Accept your author invite',
  'wrong-account': 'Invite for another account',
  expired: 'Invite expired',
} as const

const pageStyle = css({
  maxWidth: '560px',
  margin: '0 auto',
  padding: 'var(--space-14) var(--page-gutter) var(--space-24)',
  '@media (max-width: 480px)': { padding: 'var(--space-8) var(--space-4) var(--space-16)' },
})
const cardStyle = css({ padding: 'var(--space-8)', gap: 'var(--space-5)', '@media (max-width: 480px)': { padding: 'var(--space-5)' } })
const headingStyle = css({
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(28px, 4vw, 40px)',
  lineHeight: 1.05,
  letterSpacing: 'var(--tracking-tight)',
})
const leadStyle = css({ margin: 0, fontSize: 'var(--fs-16)', lineHeight: 1.6, color: 'var(--text-lead)' })
const monoStyle = css({ fontFamily: 'var(--font-mono)', color: 'var(--text)', overflowWrap: 'anywhere' })
