// Changing the sign-in email (decision 030). A signed-in user asks for a new
// address; it gets a 6-digit code and a link (the sign-in primitives: hashed,
// 15 minutes, single use, 5 code tries). Nothing changes until one of them
// comes back, from the account's own session. Then one D1 batch moves the
// email, and the old address gets a notice with a 7-day revert link.
import {
  cancelEmailChanges,
  completeEmailChange,
  findPendingEmailChange,
  findUserByEmail,
  insertEmailToken,
  peekEmailChange,
  reserveEmailChangeAttempt,
  peekEmailRevert,
  revertEmailChange,
  type D1DataTableDatabase,
  type EmailRevertResult,
  type OpenEmailRevert,
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

/** How long the old address can undo a change (decision 030). */
export const REVERT_TTL_DAYS = 7
/** On revert, passkeys added this long before the change (or since) are removed too. */
const REVERT_PASSKEY_WINDOW_MS = 24 * 60 * 60 * 1000

/** Confirms with the 6-digit code, from the signed-in session of the account. */
export async function confirmEmailChangeCode(
  db: D1DataTableDatabase,
  input: { user: User; code: string; origin: string },
): Promise<EmailChangeConfirmResult> {
  let now = Date.now()
  let open = await reserveEmailChangeAttempt(db, input.user.id, now, MAX_CODE_ATTEMPTS)
  if (!open) return { ok: false, reason: 'expired' }
  if (!digestsEqual(await codeHash(open.token_hash, input.code), open.code_hash)) {
    return { ok: false, reason: open.attempts < MAX_CODE_ATTEMPTS ? 'wrong' : 'expired' }
  }
  return finish(db, { tokenHash: open.token_hash, user: input.user, origin: input.origin })
}

/**
 * Confirms with the link. Only the account's own signed-in session can: the
 * link proves the new inbox, the session proves the account, and a link
 * never signs anyone in.
 */
export async function confirmEmailChangeLink(
  db: D1DataTableDatabase,
  input: { token: string; user: User; origin: string },
): Promise<EmailChangeConfirmResult> {
  let open = await peekEmailChangeLink(db, input.token)
  if (!open || open.user_id !== input.user.id) return { ok: false, reason: 'expired' }
  return finish(db, { tokenHash: open.token_hash, user: input.user, origin: input.origin })
}

async function finish(
  db: D1DataTableDatabase,
  input: { tokenHash: string; user: User; origin: string },
): Promise<EmailChangeConfirmResult> {
  let now = Date.now()
  let revertToken = randomToken()
  let result = await completeEmailChange(db, {
    tokenHash: input.tokenHash,
    userId: input.user.id,
    now,
    revertTokenHash: await sha256Hex(revertToken),
    revertExpiresAt: now + REVERT_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
  if (!result.ok) return result
  let revertLink = new URL(
    routes.auth.emailRevert.index.href(undefined, { searchParams: { token: revertToken } }),
    input.origin,
  ).href
  try {
    await sendMail(emailChangedMail({ to: input.user.email, newEmail: result.email, revertLink, days: REVERT_TTL_DAYS }))
  } catch (error) {
    // The change is done; a failed notice is logged by the mailer, not fatal.
    if (!(error instanceof MailError)) throw error
  }
  return { ok: true, userId: input.user.id, email: result.email }
}

/** The open revert behind a link, without spending it (confirmation page). */
export async function peekEmailRevertLink(db: D1DataTableDatabase, token: string): Promise<OpenEmailRevert | null> {
  if (!isTokenShaped(token)) return null
  return peekEmailRevert(db, await sha256Hex(token), Date.now())
}

/**
 * Undoes a change from the old address: the old email comes back, every
 * session ends and passkeys added around the change are removed. Like the
 * change link, it never signs anyone in; the owner signs in again with the
 * restored email.
 */
export async function revertEmailChangeLink(db: D1DataTableDatabase, token: string): Promise<EmailRevertResult> {
  let open = await peekEmailRevertLink(db, token)
  if (!open) return { ok: false, reason: 'expired' }
  return revertEmailChange(db, {
    tokenHash: open.token_hash,
    now: Date.now(),
    passkeysSince: open.created_at - REVERT_PASSKEY_WINDOW_MS,
  })
}
