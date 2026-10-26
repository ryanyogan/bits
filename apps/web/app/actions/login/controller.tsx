import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { requestEmailSignIn, type EmailRequestResult } from '../../auth/email-sign-in.ts'
import { currentUser } from '../../auth/identity.ts'
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from '../../auth/turnstile.ts'
import { routes } from '../../routes.ts'
import { LoginPage, type LoginNotice } from './login-page.tsx'
import { issueField, loginForm, readGoals, readText, safeNextPath, type FormIssue, type LoginMode } from './schema.ts'

export default createController(routes.login, {
  actions: {
    index(context) {
      let params = context.url.searchParams
      let next = safeNextPath(params.get('next'))
      // Already signed in: nothing to do here.
      if (currentUser(context)) return redirect(next ?? routes.courses.index.href(), 303)
      let mode: LoginMode = params.get('mode') === 'signup' ? 'signup' : 'signin'
      return context.render(
        <LoginPage
          mode={mode}
          next={next}
          turnstileSiteKey={turnstileSiteKey()}
          notice={noticeFor(params.get('notice') ?? params.get('error'))}
        />,
      )
    },

    // Request a magic link + code: Turnstile, then the per-email and per-IP
    // limits, then store the hashed token and send the email (decision 015).
    async action(context) {
      let parsed = s.parseSafe(loginForm, context.formData)
      let mode: LoginMode = readText(context.formData, 'mode') === 'signup' ? 'signup' : 'signin'
      let rerender = (status: number, extra: { issues?: FormIssue[]; notice?: LoginNotice }) =>
        context.render(
          <LoginPage
            mode={mode}
            next={safeNextPath(readText(context.formData, 'next'))}
            values={{
              email: readText(context.formData, 'email'),
              displayName: readText(context.formData, 'displayName'),
              goals: readGoals(context.formData),
            }}
            turnstileSiteKey={turnstileSiteKey()}
            {...extra}
          />,
          { status },
        )

      if (!parsed.success) return rerender(422, { issues: parsed.issues.map(friendlyIssue) })

      let ip = context.headers.get('CF-Connecting-IP')
      let human = await verifyTurnstile(context.formData.get(TURNSTILE_FIELD), { action: 'login', remoteIp: ip })
      if (!human) {
        return rerender(422, {
          notice: { tone: 'danger', text: 'We couldn’t confirm you’re a person. Wait for the check to finish, then try again.' },
        })
      }

      let { email, mode: parsedMode, next, displayName, goals, timezone } = parsed.value
      let result = await requestEmailSignIn(context.db, {
        email,
        signup: parsedMode === 'signup' ? { displayName, goals, timezone } : null,
        next: next ?? null,
        ip,
        origin: context.url.origin,
      })
      if (!result.ok) {
        let failure = failures[result.reason]
        return rerender(failure.status, { notice: { tone: 'danger', text: failure.text } })
      }

      return redirect(
        routes.login.check.index.href(undefined, {
          searchParams: { email, ...(parsedMode === 'signup' ? { mode: parsedMode } : {}), ...(next ? { next } : {}) },
        }),
        303,
      )
    },
  },
})

const failures: Record<Extract<EmailRequestResult, { ok: false }>['reason'], { status: number; text: string }> = {
  'rate-email': {
    status: 429,
    text: 'We’ve sent this address 3 emails in the last 10 minutes. Use the newest one, or try again in a few minutes.',
  },
  'rate-ip': { status: 429, text: 'Too many sign-in emails from this network. Try again in an hour.' },
  'send-failed': { status: 503, text: 'We couldn’t send the email just now. Try again in a minute.' },
}

/** `?error=` from OAuth callbacks and `?notice=` from sign-out flows. */
function noticeFor(code: string | null): LoginNotice | undefined {
  switch (code) {
    case 'signed-out-everywhere':
      return { tone: 'ok', text: 'You’re signed out on every device.' }
    case 'github-unavailable':
    case 'google-unavailable':
      return {
        tone: 'warning',
        text: `${code.startsWith('github') ? 'GitHub' : 'Google'} sign-in isn’t switched on yet. Use email for now.`,
      }
    case 'oauth-failed':
      return { tone: 'danger', text: 'That sign-in didn’t finish. Try again, or use email.' }
    case 'oauth-no-email':
      return {
        tone: 'warning',
        text: 'That account didn’t share a verified email, so we can’t create an account from it. Use email instead.',
      }
    case 'link-expired':
      return { tone: 'warning', text: 'That sign-in link has expired or was already used. Ask for a new one.' }
    default:
      return undefined
  }
}

const friendly: Record<string, string> = {
  email: 'Enter an email address like you@somewhere.dev.',
  displayName: 'Keep your name under 60 characters.',
}

function friendlyIssue(issue: FormIssue): FormIssue {
  let field = issueField(issue)
  let message = typeof field === 'string' ? friendly[field] : undefined
  return message ? { ...issue, message } : issue
}
