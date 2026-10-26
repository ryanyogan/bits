// Request identity: resolves the session's user record into `context.auth`
// (remix/middleware/auth), protects routes, and maps the user to the
// `Viewer` the pages render.
import { findUserById, type D1DataTableDatabase, type User } from '@bits/db'
import { auth, Auth, createSessionAuthScheme, requireAuth, type AuthState } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import type { Viewer } from '../data/fixtures.ts'
import { routes } from '../routes.ts'
import { readUserRecord, USER_KEY, type UserRecord } from './session.ts'

/** Renew a signed-in session (row expiry and cookie Max-Age) at most once a day. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000

/** Router middleware: `context.auth` is `{ ok: true, identity: User }` when signed in. */
export function loadAuth(db: D1DataTableDatabase) {
  return auth({
    schemes: [
      createSessionAuthScheme<User, UserRecord>({
        name: 'session',
        read: (session) => readUserRecord(session),
        async verify(record, context) {
          let user = await findUserById(db, record.userId)
          if (!user) return null
          let now = Date.now()
          if (now - record.seenAt > RENEW_AFTER_MS) {
            // Dirtying the session makes the store extend the row and the
            // middleware re-send the cookie with a fresh 30-day Max-Age.
            context.get(Session)?.set(USER_KEY, { ...record, seenAt: now })
          }
          return user
        },
        invalidate: (session) => session.unset(USER_KEY),
      }),
    ],
  })
}

/** Any request context, whatever middleware put on it (RequestContext is invariant). */
type AnyContext = RequestContext<any, any>

/** The signed-in user, or null. */
export function currentUser(context: AnyContext): User | null {
  let state = context.get(Auth) as AuthState<User> | undefined
  return state?.ok ? state.identity : null
}

/** The signed-in viewer for page chrome, or null when signed out. */
export function getViewer(context: AnyContext): Viewer | null {
  let user = currentUser(context)
  return user ? toViewer(user) : null
}

export function toViewer(user: User): Viewer {
  let name = user.display_name || user.handle
  return {
    id: user.id,
    role: user.role,
    name,
    handle: user.handle,
    initials: initialsOf(name),
    email: user.email,
    xp: user.xp_total,
    // Streaks arrive with progress tracking (activity_days).
    streak: 0,
    bestStreak: 0,
    isPublic: user.is_public,
  }
}

function initialsOf(name: string): string {
  let words = name.split(/[\s_.-]+/).filter(Boolean)
  let letters = words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : name.slice(0, 2)
  return letters.toUpperCase()
}

/** `/login?next=<this page>` for a signed-out request. */
export function loginRedirect(context: AnyContext): Response {
  let next = context.method === 'GET' ? context.url.pathname + context.url.search : undefined
  return redirect(routes.login.index.href(undefined, { searchParams: next ? { next } : {} }), 303)
}

/** Controller or action middleware: signed-out requests go to /login and come back after. */
export function requireUser() {
  return requireAuth<User>({ onFailure: (context) => loginRedirect(context) })
}

/** Authors manage their own courses; admins can manage everything (handoff, Roles). */
export function canAuthor(user: Pick<User, 'role'>): boolean {
  return user.role === 'author' || user.role === 'admin'
}
