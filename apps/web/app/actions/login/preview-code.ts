// Sign-in on Workers Previews (decision 038). A preview has no mail, so
// POST /login flashes the code into this browser's session and
// /login/check shows it once. The session, not the URL: a code in a query
// string would land in history, logs and Referer headers.
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

const PREVIEW_CODE_KEY = 'previewCode'

type AnyContext = RequestContext<any, any>

/** Shows `code` on the next page this browser loads (the check page). */
export function flashPreviewCode(context: AnyContext, email: string, code: string): void {
  context.get(Session)?.flash(PREVIEW_CODE_KEY, { email, code })
}

/** The flashed code, only when it was asked for `email`. */
export function takePreviewCode(context: AnyContext, email: string): string | undefined {
  let value = context.get(Session)?.get(PREVIEW_CODE_KEY) as { email?: unknown; code?: unknown } | undefined
  if (!value || typeof value !== 'object') return undefined
  if (value.email !== email || typeof value.code !== 'string' || !/^\d{6}$/.test(value.code)) return undefined
  return value.code
}
