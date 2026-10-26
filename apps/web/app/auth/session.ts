// Browser sessions: remix/session with a D1-backed SessionStorage.
//
// The `__Host-session` cookie carries the session id, signed with
// SESSION_SECRET. D1 keys the row by the SHA-256 of that id, so a database
// leak cannot replay a session. Rows are written only when the session
// changes: an anonymous visitor who never signs in costs no writes.
import { deleteSession, readSession, saveSession, type D1DataTableDatabase } from '@bits/db'
import { createCookie } from 'remix/cookie'
import { session as sessionMiddleware } from 'remix/middleware/session'
import { createSession, type Session, type SessionStorage } from 'remix/session'

import { SESSION_MAX_AGE_SECONDS, sessionSecrets } from './config.ts'
import { sha256Hex } from './crypto.ts'

/** Session key for the signed-in record. (`__auth` is remix/auth's OAuth transaction.) */
export const USER_KEY = 'user'

export type SignInMethod = 'email' | 'github' | 'google'

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

/** remix/session storage backed by the D1 `sessions` table. */
export function createD1SessionStorage(db: D1DataTableDatabase): SessionStorage {
  return {
    async read(cookie) {
      if (cookie) {
        let row = await readSession(db, await sha256Hex(cookie), Date.now())
        if (row) {
          try {
            return createSession(cookie, JSON.parse(row.data))
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
      await saveSession(db, {
        idHash: await sha256Hex(session.id),
        userId: record?.userId ?? null,
        data: JSON.stringify(session.data),
        userAgent: record?.ua ?? null,
        expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
        now,
      })
      return session.id
    },
  }
}

/** Router middleware: loads the session onto `context.session`, saves it after. */
export function loadSession(db: D1DataTableDatabase) {
  return sessionMiddleware(sessionCookie, createD1SessionStorage(db))
}
