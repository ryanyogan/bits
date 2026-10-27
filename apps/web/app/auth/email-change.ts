// Changing the sign-in email (decision 030). A signed-in user asks for a new
// address; it gets a 6-digit code and a link (the sign-in primitives: hashed,
// 15 minutes, single use, 5 code tries). Nothing changes until one of them
// comes back. Then one D1 batch moves the email, and the old address gets a
// notice.
import {
  cancelEmailChanges,
  completeEmailChange,
  findPendingEmailChange,
  findUserByEmail,
  findUserById,
  insertEmailToken,
  peekEmailChange,
  reserveEmailChangeAttempt,
  type D1DataTableDatabase,
  type PendingEmailChange,
  type User,
} from '@bits/db'

import { routes } from '../routes.ts'
import { digestsEqual, randomCode, randomToken, sha256Hex } from './crypto.ts'
import { confirmEmailChangeMail, emailChangedMail, emailTakenMail } from './email-change-mail.ts'
import { checkEmailLimits, codeHash, isTokenShaped, MAX_CODE_ATTEMPTS, TOKEN_TTL_MINUTES } from './email-sign-in.ts'
import { MailError, sendMail } from './mailer.ts'

export type EmailChangeRequestResult = { ok: true } | { ok: false; reason: 'rate-email' | 'rate-ip' | 'send-failed' }

/**
 * Stores a change token for `email` and mails the new address. When the
 * address already has an account, it gets a notice instead of a code, and
 * the requester sees the same "check your inbox" (no account lookup leak).
 */
export async function requestEmailChange(
  db: D1DataTableDatabase,
  input: { user: User; email: string; ip: string | null; origin: string },
): Promise<EmailChangeRequestResult> {
  let now = Date.now()
  let limits = await checkEmailLimits(db, input.email, input.ip, now)
  if (!limits.ok) return limits

  let token = randomToken()
  let code = randomCode()
  let tokenHash = await sha256Hex(token)
  // One open change at a time: a new request replaces the last one.
  await cancelEmailChanges(db, input.user.id, now)
  await insertEmailToken(db, {
    tokenHash,
    codeHash: await codeHash(tokenHash, code),
    email: input.email,
    ipHash: limits.ipHash,
    signup: null,
    nextPath: null,
    expiresAt: now + TOKEN_TTL_MINUTES * 60 * 1000,
    now,
    purpose: 'email-change',
    userId: input.user.id,
  })

  let owner = await findUserByEmail(db, input.email)
  let link = new URL(routes.auth.email.index.href(undefined, { searchParams: { token } }), input.origin).href
  let message =
    owner && owner.id !== input.user.id
      ? emailTakenMail({ to: input.email })
      : confirmEmailChangeMail({ to: input.email, code, link, minutes: TOKEN_TTL_MINUTES })
  try {
    await sendMail(message)
  } catch (error) {
    if (error instanceof MailError) {
      await cancelEmailChanges(db, input.user.id, now)
      return { ok: false, reason: 'send-failed' }
    }
    throw error
  }
  return { ok: true }
}

/** The user's open change, for the "check your inbox" state in Settings. */
export function pendingEmailChange(db: D1DataTableDatabase, userId: string): Promise<PendingEmailChange | null> {
  return findPendingEmailChange(db, userId, Date.now())
}

export function cancelEmailChange(db: D1DataTableDatabase, userId: string): Promise<void> {
  return cancelEmailChanges(db, userId, Date.now())
}

/** The open change behind a link, without spending it (confirmation page). */
export async function peekEmailChangeLink(db: D1DataTableDatabase, token: string): Promise<PendingEmailChange | null> {
  if (!isTokenShaped(token)) return null
  return peekEmailChange(db, await sha256Hex(token), Date.now())
}

export type EmailChangeConfirmResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'wrong' | 'expired' | 'taken' }

/** Confirms with the 6-digit code from the signed-in session that asked. */
export async function confirmEmailChangeCode(
  db: D1DataTableDatabase,
  input: { user: User; code: string; sessionId: string },
): Promise<EmailChangeConfirmResult> {
  let now = Date.now()
  let open = await reserveEmailChangeAttempt(db, input.user.id, now, MAX_CODE_ATTEMPTS)
  if (!open) return { ok: false, reason: 'expired' }
  if (!digestsEqual(await codeHash(open.token_hash, input.code), open.code_hash)) {
    return { ok: false, reason: open.attempts < MAX_CODE_ATTEMPTS ? 'wrong' : 'expired' }
  }
  return finish(db, { tokenHash: open.token_hash, userId: input.user.id, oldEmail: input.user.email, sessionId: input.sessionId })
}

/**
 * Confirms with the link. `sessionId` is kept signed in when it already
 * belongs to the account; the caller signs this browser in otherwise.
 */
export async function confirmEmailChangeLink(
  db: D1DataTableDatabase,
  input: { token: string; signedInUserId: string | null; sessionId: string },
): Promise<EmailChangeConfirmResult> {
  let open = await peekEmailChangeLink(db, input.token)
  if (!open) return { ok: false, reason: 'expired' }
  let owner = await findUserById(db, open.user_id)
  if (!owner) return { ok: false, reason: 'expired' }
  return finish(db, {
    tokenHash: open.token_hash,
    userId: open.user_id,
    oldEmail: owner.email,
    sessionId: input.signedInUserId === open.user_id ? input.sessionId : null,
  })
}

async function finish(
  db: D1DataTableDatabase,
  input: { tokenHash: string; userId: string; oldEmail: string; sessionId: string | null },
): Promise<EmailChangeConfirmResult> {
  let result = await completeEmailChange(db, {
    tokenHash: input.tokenHash,
    userId: input.userId,
    now: Date.now(),
    keepSessionHash: input.sessionId ? await sha256Hex(input.sessionId) : null,
  })
  if (!result.ok) return result
  try {
    await sendMail(emailChangedMail({ to: input.oldEmail, newEmail: result.email }))
  } catch (error) {
    // The change is done; a failed notice is logged by the mailer, not fatal.
    if (!(error instanceof MailError)) throw error
  }
  return { ok: true, userId: input.userId, email: result.email }
}
