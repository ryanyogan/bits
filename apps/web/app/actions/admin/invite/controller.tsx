import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { acceptAuthorInviteLink, inviteIsFor, peekAuthorInvite } from '../../../auth/author-invites.ts'
import { maskEmail } from '../../../auth/email-change.ts'
import { currentUser, getViewer, loginRedirect, toViewer } from '../../../auth/identity.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { routes } from '../../../routes.ts'
import { readText } from '../../login/schema.ts'
import { InvitePage } from './invite-page.tsx'

// The token is in the URL: keep it out of caches and Referer headers.
const pageHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

// An author invite link (decision 037). The link proves the inbox; the
// session must be signed in as the invited address. It never signs anyone
// in: signed-out visitors go through /login and come back here.
export default createController(routes.admin.invite, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token') ?? ''
      let invite = await peekAuthorInvite(context.db, token)
      if (!invite) return context.render(<InvitePage kind="expired" viewer={getViewer(context)} />, { status: 410, headers: pageHeaders })
      let user = currentUser(context)
      if (!user) return loginRedirect(context)
      let viewer = toViewer(user)
      if (!inviteIsFor(invite, user)) {
        return context.render(<InvitePage kind="wrong-account" viewer={viewer} invited={maskEmail(invite.email)} />, {
          headers: pageHeaders,
        })
      }
      return context.render(
        <InvitePage kind="accept" viewer={viewer} token={token} from={invite.invited_by_handle} courses={invite.course_titles} />,
        { headers: pageHeaders },
      )
    },

    action: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let token = readText(context.formData, 'token')
        let user = currentUser(context)
        let invite = await peekAuthorInvite(context.db, token)
        if (!invite) return context.render(<InvitePage kind="expired" viewer={getViewer(context)} />, { status: 410, headers: pageHeaders })
        if (!user) return redirect(routes.admin.invite.index.href(undefined, { searchParams: { token } }), 303)
        if (!inviteIsFor(invite, user)) {
          return context.render(<InvitePage kind="wrong-account" viewer={toViewer(user)} invited={maskEmail(invite.email)} />, {
            status: 403,
            headers: pageHeaders,
          })
        }
        // The statement re-checks everything: open, unexpired, this user's current address.
        if (!(await acceptAuthorInviteLink(context.db, { token, user }))) {
          return context.render(<InvitePage kind="expired" viewer={toViewer(user)} />, { status: 410, headers: pageHeaders })
        }
        return redirect(routes.author.index.href(), 303)
      },
    },
  },
})
