import { findUserById } from '@bits/db'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { confirmEmailChangeLink, peekEmailChangeLink } from '../../../auth/email-change.ts'
import { currentUser } from '../../../auth/identity.ts'
import { startUserSession } from '../../../auth/users.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { routes } from '../../../routes.ts'
import { readText } from '../../login/schema.ts'
import { ConfirmEmailPage } from './confirm-email-page.tsx'

const settingsEmail = (saved: string) =>
  redirect(`${routes.settings.index.href(undefined, { searchParams: { saved } })}#email`, 303)

const linkExpired = () =>
  redirect(routes.login.index.href(undefined, { searchParams: { error: 'email-link-expired' } }), 303)

// The confirm-new-email link (decision 030). It works on any device: the
// token was mailed to the new address, which is proof enough, and it signs
// that browser in to the account, like a magic link.
export default createController(routes.auth.email, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token') ?? ''
      let open = await peekEmailChangeLink(context.db, token)
      if (!open) return linkExpired()
      return context.render(<ConfirmEmailPage token={token} email={open.email} />, {
        headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      })
    },

    action: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let signedIn = currentUser(context)
        let result = await confirmEmailChangeLink(context.db, {
          token: readText(context.formData, 'token'),
          signedInUserId: signedIn?.id ?? null,
          sessionId: context.session.id,
        })
        if (!result.ok) {
          if (result.reason === 'taken') return signedIn ? settingsEmail('email-taken') : linkExpired()
          return linkExpired()
        }
        if (signedIn?.id !== result.userId) {
          let user = await findUserById(context.db, result.userId)
          if (user) await startUserSession(context, user, 'email')
        }
        return settingsEmail('email-changed')
      },
    },
  },
})
