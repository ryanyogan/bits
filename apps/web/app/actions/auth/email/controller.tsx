import { findUserById, type User } from '@bits/db'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { confirmEmailChangeLink, maskEmail, peekEmailChangeLink } from '../../../auth/email-change.ts'
import { currentUser } from '../../../auth/identity.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { routes } from '../../../routes.ts'
import { readText } from '../../login/schema.ts'
import { EmailLinkPage } from './confirm-email-page.tsx'

const settingsEmail = (saved: string) =>
  redirect(`${routes.settings.index.href(undefined, { searchParams: { saved } })}#email`, 303)

export const emailLinkExpired = () =>
  redirect(routes.login.index.href(undefined, { searchParams: { error: 'email-link-expired' } }), 303)

const pageHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

// The confirm-new-email link (decision 030). The link proves the new inbox;
// only the account's own signed-in session can use it, and it never signs
// anyone in. Anyone else is told which account it belongs to and to sign in.
export default createController(routes.auth.email, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token') ?? ''
      let open = await peekEmailChangeLink(context.db, token)
      if (!open) return emailLinkExpired()
      let user = currentUser(context)
      if (user?.id !== open.user_id) return signInFirst(context, open.user_id, open.email, 200)
      return context.render(<EmailLinkPage kind="confirm" token={token} email={open.email} />, { headers: pageHeaders })
    },

    action: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let token = readText(context.formData, 'token')
        let open = await peekEmailChangeLink(context.db, token)
        if (!open) return emailLinkExpired()
        let user = currentUser(context)
        if (!user || user.id !== open.user_id) return signInFirst(context, open.user_id, open.email, 403)
        let result = await confirmEmailChangeLink(context.db, {
          token,
          user,
          origin: context.url.origin,
          sessionId: context.session.id,
        })
        if (!result.ok) return result.reason === 'taken' ? settingsEmail('email-taken') : emailLinkExpired()
        return settingsEmail('email-changed')
      },
    },
  },
})

async function signInFirst(
  context: { db: Parameters<typeof findUserById>[0]; render: (node: any, init?: ResponseInit) => Response | Promise<Response> },
  userId: string,
  email: string,
  status: number,
) {
  let owner: User | null = await findUserById(context.db, userId)
  if (!owner) return emailLinkExpired()
  return context.render(<EmailLinkPage kind="sign-in-first" email={email} account={maskEmail(owner.email)} />, {
    status,
    headers: pageHeaders,
  })
}
