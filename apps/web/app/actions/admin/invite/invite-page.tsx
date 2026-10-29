import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { Keycap } from '@bits/ui/keycap'
import { PageFrame } from '@bits/ui/page-frame'
import { PendingSubmit } from '@bits/ui/pending-submit'

import type { Viewer } from '../../../auth/identity.ts'
import { APP_NAME } from '../../../config.ts'
import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { PageHead } from '../../../ui/page-head.tsx'

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
      <Layout title={titles[props.kind]} viewer={props.viewer}>
        <PageFrame>
          {props.kind === 'accept' ? (
            <PageHead
              label="Author invite"
              title={`Write courses on ${APP_NAME}?`}
              lead={
                <>
                  {props.from ? <>@{props.from} invited you to be an author. </> : <>You’re invited to be an author. </>}
                  {props.courses.length ? (
                    <>
                      You’ll join <strong>{props.courses.join(', ')}</strong>.
                    </>
                  ) : (
                    <>You can upload and publish your own courses.</>
                  )}
                </>
              }
            >
              <form method="post" action={routes.admin.invite.action.href()} mix={actionStyle}>
                <input type="hidden" name="token" value={props.token} />
                <PendingSubmit label="Accept the invite →" pendingLabel="Accepting…" block />
              </form>
            </PageHead>
          ) : props.kind === 'wrong-account' ? (
            <PageHead
              label="Author invite"
              title="This invite is for someone else."
              lead={
                <>
                  It was sent to <span mix={monoStyle}>{props.invited}</span>, and you’re signed in as{' '}
                  <span mix={monoStyle}>{props.viewer.email}</span>. Sign out, open the link from the email again and
                  sign in with the address it was sent to.
                </>
              }
            >
              <form method="post" action={routes.logout.action.href()} mix={actionStyle}>
                <Keycap type="submit" variant="dark" block>
                  Sign out
                </Keycap>
              </form>
            </PageHead>
          ) : (
            <PageHead
              label="Author invite"
              title="This invite has expired."
              lead="It was already used, withdrawn, or is more than 7 days old. Ask the admin who invited you for a new one."
            >
              <div mix={actionStyle}>
                <Keycap href={routes.home.href()} variant="dark" block>
                  Back to {APP_NAME}
                </Keycap>
              </div>
            </PageHead>
          )}
        </PageFrame>
      </Layout>
    )
  }
}

const titles = {
  accept: 'Accept your author invite',
  'wrong-account': 'Invite for another account',
  expired: 'Invite expired',
} as const

const actionStyle = css({ width: '100%', maxWidth: '360px', paddingTop: 'var(--space-3)' })
const monoStyle = css({ fontFamily: 'var(--font-mono)', color: 'var(--text)', overflowWrap: 'anywhere' })
