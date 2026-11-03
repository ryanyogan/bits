// The address a sign-in code was just sent to (decision 065). It lives in
// this browser's session, never in the check page's URL: a query string
// lands in history, Referer headers and analytics.
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

const PENDING_EMAIL_KEY = 'signInEmail'

type AnyContext = RequestContext<any, any>

/** Remembers `email` for `GET /login/check` (and a reload of it). */
export function rememberPendingEmail(context: AnyContext, email: string): void {
  context.get(Session)?.set(PENDING_EMAIL_KEY, email)
}

/** The address POST /login last sent a code to from this browser. */
export function pendingEmail(context: AnyContext): string | undefined {
  let value = context.get(Session)?.get(PENDING_EMAIL_KEY)
  return typeof value === 'string' && value.length <= 254 && value.includes('@') ? value : undefined
}

