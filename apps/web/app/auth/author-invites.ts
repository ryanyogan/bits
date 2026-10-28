// Author invites (decision 037). An admin invites an email address; it gets
// a single-use link for 7 days. The link proves the inbox, and the session
// proves the account: it only works from a session signed in as that
// address, and it never signs anyone in. The token is stored as its SHA-256
// digest, like every other emailed secret (decision 015).
import {
  acceptAuthorInvite,
  AUTHOR_INVITE_TTL_MS,
  findOpenAuthorInvite,
  insertAuthorInvite,
  revokeAuthorInvite,
  type D1DataTableDatabase,
  type OpenAuthorInvite,
  type User,
} from '@bits/db'

import { routes } from '../routes.ts'
import { authorInviteMail } from './author-invite-mail.ts'
import { randomToken, sha256Hex } from './crypto.ts'
import { isTokenShaped } from './email-sign-in.ts'
import { reserveMail } from './mail-quota.ts'
import { MailError, sendMail } from './mailer.ts'
import { isAdmin } from './require-admin.tsx'

export const AUTHOR_INVITE_TTL_DAYS = AUTHOR_INVITE_TTL_MS / (24 * 60 * 60 * 1000)

export type InviteResult = { ok: true } | { ok: false; reason: 'forbidden' | 'send-failed' | 'rate-global' }

/**
 * Stores an invite (replacing any open one to the address) and mails the
 * link. The mail takes a slot under the daily cap first (decision 039);
 * callers have already checked the admin role (requireAdmin), and the
 * insert checks it again.
 */
export async function inviteAuthor(
  db: D1DataTableDatabase,
  input: { admin: User; email: string; courses: string[]; origin: string },
): Promise<InviteResult> {
  if (!isAdmin(input.admin)) return { ok: false, reason: 'forbidden' }
  if (!(await reserveMail(db, 'author-invite'))) return { ok: false, reason: 'rate-global' }
  let now = Date.now()
  let id = crypto.randomUUID()
  let token = randomToken()
  let stored = await insertAuthorInvite(db, {
    id,
    tokenHash: await sha256Hex(token),
    email: input.email,
    courses: input.courses,
    adminId: input.admin.id,
    expiresAt: now + AUTHOR_INVITE_TTL_MS,
    now,
  })
  if (!stored) return { ok: false, reason: 'forbidden' }
  let link = new URL(routes.admin.invite.index.href(undefined, { searchParams: { token } }), input.origin).href
  try {
    await sendMail(
      authorInviteMail({ to: input.email, link, days: AUTHOR_INVITE_TTL_DAYS, from: input.admin.display_name || input.admin.handle }),
    )
  } catch (error) {
    if (!(error instanceof MailError)) throw error
    // An invite nobody received shouldn't sit on the page as pending.
    await revokeAuthorInvite(db, { id, adminId: input.admin.id, now })
    return { ok: false, reason: 'send-failed' }
  }
  return { ok: true }
}

/** The open invite behind a link, without spending it (the GET page). */
export async function peekAuthorInvite(db: D1DataTableDatabase, token: string): Promise<OpenAuthorInvite | null> {
  if (!isTokenShaped(token)) return null
  return findOpenAuthorInvite(db, await sha256Hex(token), Date.now())
}

/**
 * Spends the invite for the signed-in user. The address check happens in
 * the same statement that spends it, against the user's current email.
 */
export async function acceptAuthorInviteLink(db: D1DataTableDatabase, input: { token: string; user: User }): Promise<boolean> {
  if (!isTokenShaped(input.token)) return false
  return acceptAuthorInvite(db, { tokenHash: await sha256Hex(input.token), userId: input.user.id, now: Date.now() })
}

/** True when the signed-in user's address is the one the invite was sent to. */
export function inviteIsFor(invite: Pick<OpenAuthorInvite, 'email'>, user: Pick<User, 'email'>): boolean {
  return invite.email.toLowerCase() === user.email.toLowerCase()
}
