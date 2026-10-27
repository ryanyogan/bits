import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { peekEmailRevertLink, revertEmailChangeLink } from '../../../auth/email-change.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { routes } from '../../../routes.ts'
import { EmailLinkPage } from '../email/confirm-email-page.tsx'
import { emailLinkExpired } from '../email/controller.tsx'
import { readText } from '../../login/schema.ts'

const toLogin = (key: 'notice' | 'error', value: string) =>
  redirect(routes.login.index.href(undefined, { searchParams: { [key]: value } }), 303)

// The old address's "this wasn't me" link (decision 030, 7 days). It puts
// the old email back, ends every session (this browser's too) and removes
// passkeys added around the change. It never signs anyone in: the owner
// signs in again with the restored email.
export default createController(routes.auth.emailRevert, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token') ?? ''
      let open = await peekEmailRevertLink(context.db, token)
      if (!open) return emailLinkExpired()
      return context.render(<EmailLinkPage kind="revert" token={token} email={open.email} />, {
        headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      })
    },

    action: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let result = await revertEmailChangeLink(context.db, readText(context.formData, 'token'))
        if (!result.ok) return result.reason === 'taken' ? toLogin('error', 'email-revert-taken') : emailLinkExpired()
        return toLogin('notice', 'email-reverted')
      },
    },
  },
})
