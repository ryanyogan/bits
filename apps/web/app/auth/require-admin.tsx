// Admin-only areas (decision 037). Use after requireUser(): signed-out
// requests have already gone to /login. The role comes from the users row
// read for this request, never from the session or the form.
import type { Middleware } from 'remix/router'

import { APP_NAME } from '../config.ts'
import type { AppContext } from '../router.ts'
import { ForbiddenPage } from '../ui/not-found-page.tsx'
import { currentUser, getViewer } from './identity.ts'

export function isAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === 'admin'
}

/** Controller or action middleware: anyone but an admin gets a 403 page. */
export function requireAdmin(): Middleware {
  return (context, next) => {
    if (isAdmin(currentUser(context))) return next()
    return (context as unknown as AppContext).render(
      <ForbiddenPage viewer={getViewer(context)} hint={`This page is for ${APP_NAME} admins.`} />,
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
