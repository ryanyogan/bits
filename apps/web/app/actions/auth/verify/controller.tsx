import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { peekMagicLink, redeemCode, redeemMagicLink } from '../../../auth/email-sign-in.ts'
import { turnstileSiteKey } from '../../../auth/turnstile.ts'
import { parseSignup, startUserSession, userForVerifiedEmail } from '../../../auth/users.ts'
import { routes } from '../../../routes.ts'
import { CheckEmailPage } from '../../login/check/check-email-page.tsx'
import { readText, safeNextPath, verifyCodeForm } from '../../login/schema.ts'
import { ConfirmLinkPage } from './confirm-link-page.tsx'

const linkExpired = () => redirect(routes.login.index.href(undefined, { searchParams: { error: 'link-expired' } }), 303)

export default createController(routes.auth.verify, {
  actions: {
    // The magic link lands here. Show a confirm button; don't spend the token.
    async index(context) {
      let token = context.url.searchParams.get('token') ?? ''
      let open = await peekMagicLink(context.db, token)
      if (!open) return linkExpired()
      return context.render(<ConfirmLinkPage token={token} email={open.email} />, {
        headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      })
    },

    // Either the confirmed magic link (`token`) or the 6-digit code (`email` + `code`).
    async action(context) {
      let token = readText(context.formData, 'token')
      let redeemed
      if (token) {
        redeemed = await redeemMagicLink(context.db, token)
        if (!redeemed) return linkExpired()
      } else {
        let parsed = s.parseSafe(verifyCodeForm, context.formData)
        let next = safeNextPath(readText(context.formData, 'next'))
        let retry = (message: string) =>
          context.render(
            <CheckEmailPage
              email={readText(context.formData, 'email')}
              next={next}
              code={readText(context.formData, 'code')}
              issues={parsed.success ? [{ message, path: ['code'] }] : parsed.issues}
              turnstileSiteKey={turnstileSiteKey()}
            />,
            { status: 422 },
          )
        if (!parsed.success) return retry('')
        let result = await redeemCode(context.db, parsed.value.email, parsed.value.code)
        if (!result.ok) {
          return retry(
            result.reason === 'wrong'
              ? 'That code isn’t right. Check the newest email and try again.'
              : 'That code has expired or had too many tries. Send a new one below.',
          )
        }
        redeemed = result.token
      }

      // Verified: the email is theirs. Find or create the user, rotate the
      // session and sign in. completeAuth keeps the session's data, so
      // anything an anonymous visitor saved carries over (decision 015).
      let { user } = await userForVerifiedEmail(context.db, redeemed.email, parseSignup(redeemed.signup))
      startUserSession(context, user, 'email')
      let next = safeNextPath(redeemed.next_path) ?? safeNextPath(readText(context.formData, 'next'))
      return redirect(next ?? routes.courses.index.href(), 303)
    },
  },
})
