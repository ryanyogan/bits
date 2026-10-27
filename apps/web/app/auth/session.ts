// Browser sessions: remix/session with a D1-backed SessionStorage.
//
// The `__Host-session` cookie carries the session id, signed with
// SESSION_SECRET. D1 keys the row by the SHA-256 of that id, so a database
// leak cannot replay a session. Rows are written only when the session
// changes: an anonymous visitor who never signs in costs no writes.
import {
  deleteSession,
  insertSession,
  readSessionWithUser,
  updateSession,
  type CompletedLesson,
  type D1DataTableDatabase,
  type SavedDraft,
  type User,
} from '@bits/db'
import { createCookie } from 'remix/cookie'
import { session as sessionMiddleware } from 'remix/middleware/session'
import type { Middleware, RequestContext } from 'remix/router'
import { createSession, Session, type SessionStorage } from 'remix/session'

import { getDatabase } from '../middleware/database.ts'

import { SESSION_MAX_AGE_SECONDS, sessionSecrets } from './config.ts'
import { sha256Hex } from './crypto.ts'

/** Session key for the signed-in record. (`__auth` is remix/auth's OAuth transaction.) */
export const USER_KEY = 'user'

export type SignInMethod = 'email' | 'github' | 'google' | 'passkey'

/** What a signed-in session stores about its user. */
export interface UserRecord {
  userId: string
  method: SignInMethod
  /** When this sign-in happened (epoch ms). */
  at: number
  /** Last time the session was renewed (epoch ms); see identity.ts. */
  seenAt: number
  /** Browser user agent at sign-in, for the settings session list. */
  ua: string | null
}

export function readUserRecord(session: Session): UserRecord | null {
  let value = session.get(USER_KEY) as Partial<UserRecord> | undefined
  if (!value || typeof value.userId !== 'string') return null
  return {
    userId: value.userId,
    method: value.method ?? 'email',
    at: Number(value.at) || 0,
    seenAt: Number(value.seenAt) || 0,
    ua: typeof value.ua === 'string' ? value.ua : null,
  }
}

export const sessionCookie = createCookie('__Host-session', {
  secrets: sessionSecrets(),
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
})

// What was read with each session in its one round trip (decision 026): the
// user row, for identity.ts to verify against instead of querying users
// again, and on pages that show progress, the completed lessons for
// progress.ts. Both are as fresh as the session itself.
const loadedUsers = new WeakMap<Session, User>()
const loadedCompleted = new WeakMap<Session, { userId: string; rows: CompletedLesson[] }>()
const loadedDrafts = new WeakMap<Session, { userId: string; lesson: string; drafts: Record<string, SavedDraft> }>()

/**
 * The user read together with this session, if it is `userId`. Undefined
 * when the session wasn't read from D1 this request or holds someone else.
 */
export function userLoadedWith(session: Session | undefined, userId: string): User | undefined {
  let user = session && loadedUsers.get(session)
  return user?.id === userId ? user : undefined
}

/** The completed lessons read together with this session, if it is `userId`'s. */
export function completedLoadedWith(session: Session | undefined, userId: string): CompletedLesson[] | undefined {
  let loaded = session && loadedCompleted.get(session)
  return loaded?.userId === userId ? loaded.rows : undefined
}

/** The drafts in `courseId/lessonSlug` read together with this session, if it is `userId`'s. */
export function draftsLoadedWith(
  session: Session | undefined,
  userId: string,
  courseId: string,
  lessonSlug: string,
): Record<string, SavedDraft> | undefined {
  let loaded = session && loadedDrafts.get(session)
  return loaded?.userId === userId && loaded.lesson === `${courseId}/${lessonSlug}` ? loaded.drafts : undefined
}

export interface SessionStorageOptions {
  /** Also read the signed-in user's completed lessons, in the same round trip. */
  withCompleted?: boolean
  /** Also read the signed-in user's drafts in this lesson, in the same round trip. */
  withDrafts?: { courseId: string; lessonSlug: string }
}

/** remix/session storage backed by the D1 `sessions` table. */
export function createD1SessionStorage(db: D1DataTableDatabase, options: SessionStorageOptions = {}): SessionStorage {
  // The id each session was read from D1 under. Saving a session with that id
  // updates its row; any other id (fresh, or rotated at sign-in) is inserted.
  let loadedIds = new WeakMap<Session, string>()

  return {
    async read(cookie) {
      if (cookie) {
        let row = await readSessionWithUser(db, await sha256Hex(cookie), Date.now(), {
          completed: options.withCompleted,
          drafts: options.withDrafts,
        })
        if (row) {
          try {
            let session = createSession(cookie, JSON.parse(row.session.data))
            loadedIds.set(session, cookie)
            if (row.user) loadedUsers.set(session, row.user)
            if (row.user && row.completed) loadedCompleted.set(session, { userId: row.user.id, rows: row.completed })
            if (row.user && row.drafts && options.withDrafts) {
              let { courseId, lessonSlug } = options.withDrafts
              loadedDrafts.set(session, { userId: row.user.id, lesson: `${courseId}/${lessonSlug}`, drafts: row.drafts })
            }
            return session
          } catch {
            // Corrupt row: fall through to a fresh session.
          }
        }
      }
      // Never adopt an unknown id from the browser (session fixation).
      return createSession()
    },

    async save(session) {
      if (session.deleteId) await deleteSession(db, await sha256Hex(session.deleteId))
      if (session.destroyed) {
        await deleteSession(db, await sha256Hex(session.id))
        return ''
      }
      if (!session.dirty) return null
      let now = Date.now()
      let record = readUserRecord(session)
      let input = {
        idHash: await sha256Hex(session.id),
        userId: record?.userId ?? null,
        data: JSON.stringify(session.data),
        userAgent: record?.ua ?? null,
        expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
        now,
      }
      if (loadedIds.get(session) !== session.id) {
        await insertSession(db, input)
      } else if (!(await updateSession(db, input))) {
        // Signed out (e.g. "sign out everywhere") while this request ran:
        // don't bring the row back; clear the cookie instead.
        return ''
      }
      return session.id
    },
  }
}

/**
 * Router middleware: loads the session onto `context.session`, saves it
 * after. The storage is built per request over `context.db`, so its queries
 * count toward the request's D1 meter (decision 026). `withCompleted` picks
 * the requests (pages that show progress, and never writes) whose session
 * read also brings the user's completed lessons; `withDrafts` names the lesson
 * whose drafts come along too (decision 029).
 */
export function loadSession(
  options: {
    withCompleted?: (context: RequestContext<any, any>) => boolean
    withDrafts?: (context: RequestContext<any, any>) => { courseId: string; lessonSlug: string } | undefined
  } = {},
): Middleware<{ key: typeof Session; value: Session; property: 'session' }> {
  return (context, next) => {
    let storage = createD1SessionStorage(getDatabase(context), {
      withCompleted: options.withCompleted?.(context),
      withDrafts: options.withDrafts?.(context),
    })
    return sessionMiddleware(sessionCookie, storage)(context, next)
  }
}
