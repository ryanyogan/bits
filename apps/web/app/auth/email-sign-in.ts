// Email sign-in: one email carries a magic link and a 6-digit code (handoff,
// Auth). Only SHA-256 hashes are stored; both expire after 15 minutes and are
// single use; the code allows 5 attempts. Requests are limited to 3 per email
// per 10 minutes and 20 per IP per hour, counted from the email_tokens rows.
import {
  consumeEmailToken,
  countEmailTokensForEmail,
  countEmailTokensForIp,
  insertEmailToken,
  reserveCodeAttempts,
  peekEmailToken,
  type D1DataTableDatabase,
  type OpenEmailToken,
} from '@bits/db'

import { routes } from '../routes.ts'
import { digestsEqual, randomCode, randomToken, sha256Hex } from './crypto.ts'
import { MailError, sendMail } from './mailer.ts'
import { signInEmail } from './sign-in-email.ts'
import type { SignupDetails } from './users.ts'

export const TOKEN_TTL_MINUTES = 15
export const MAX_CODE_ATTEMPTS = 5
const PER_EMAIL = { limit: 3, windowMs: 10 * 60 * 1000 }
const PER_IP = { limit: 20, windowMs: 60 * 60 * 1000 }

export type EmailRequestResult = { ok: true } | { ok: false; reason: 'rate-email' | 'rate-ip' | 'send-failed' }

export interface EmailRequest {
  email: string
  /** Present on sign-up: applied when the user row is created at verification. */
  signup: SignupDetails | null
  next: string | null
  /** Client IP (CF-Connecting-IP); null in local development. */
  ip: string | null
  /** Origin for the magic link, e.g. https://bits.ryanyogan.workers.dev. */
  origin: string
}

/** Rate-limits, stores a new token + code, and sends the email. */
export async function requestEmailSignIn(db: D1DataTableDatabase, input: EmailRequest): Promise<EmailRequestResult> {
  let now = Date.now()
  let ipHash = await sha256Hex(`ip:${input.ip ?? 'local'}`)
  if ((await countEmailTokensForEmail(db, input.email, now - PER_EMAIL.windowMs)) >= PER_EMAIL.limit) {
    return { ok: false, reason: 'rate-email' }
  }
  if ((await countEmailTokensForIp(db, ipHash, now - PER_IP.windowMs)) >= PER_IP.limit) {
    return { ok: false, reason: 'rate-ip' }
  }

  let token = randomToken()
  let code = randomCode()
  let tokenHash = await sha256Hex(token)
  await insertEmailToken(db, {
    tokenHash,
    codeHash: await codeHash(tokenHash, code),
    email: input.email,
    ipHash,
    signup: input.signup ? JSON.stringify(input.signup) : null,
    nextPath: input.next,
    expiresAt: now + TOKEN_TTL_MINUTES * 60 * 1000,
    now,
  })

  let link = new URL(routes.auth.verify.index.href(undefined, { searchParams: { token } }), input.origin).href
  try {
    await sendMail(signInEmail({ to: input.email, code, link, minutes: TOKEN_TTL_MINUTES }))
  } catch (error) {
    if (error instanceof MailError) return { ok: false, reason: 'send-failed' }
    throw error
  }
  return { ok: true }
}

/** The open token behind a magic link, without spending it (confirmation page). */
export async function peekMagicLink(db: D1DataTableDatabase, token: string): Promise<OpenEmailToken | null> {
  if (!isTokenShaped(token)) return null
  return peekEmailToken(db, await sha256Hex(token), Date.now())
}

/** Spends a magic-link token. Null when unknown, expired or already used. */
export async function redeemMagicLink(db: D1DataTableDatabase, token: string): Promise<OpenEmailToken | null> {
  if (!isTokenShaped(token)) return null
  return consumeEmailToken(db, await sha256Hex(token), Date.now())
}

export type CodeResult = { ok: true; token: OpenEmailToken } | { ok: false; reason: 'wrong' | 'expired' }

/**
 * Checks a 6-digit code against the email's open tokens. A wrong code costs
 * an attempt on each of them; after 5 they stop accepting codes (the link in
 * the email still works until it expires).
 */
export async function redeemCode(db: D1DataTableDatabase, email: string, code: string): Promise<CodeResult> {
  let now = Date.now()
  let open = await reserveCodeAttempts(db, email, now, MAX_CODE_ATTEMPTS)
  if (open.length === 0) return { ok: false, reason: 'expired' }

  for (let candidate of open) {
    if (digestsEqual(await codeHash(candidate.token_hash, code), candidate.code_hash)) {
      let token = await consumeEmailToken(db, candidate.token_hash, now)
      return token ? { ok: true, token } : { ok: false, reason: 'expired' }
    }
  }

  let attemptsLeft = Math.max(...open.map((candidate) => MAX_CODE_ATTEMPTS - candidate.attempts))
  return { ok: false, reason: attemptsLeft > 0 ? 'wrong' : 'expired' }
}

/** The code is salted with its token's hash so equal codes never share a digest. */
function codeHash(tokenHash: string, code: string): Promise<string> {
  return sha256Hex(`code:${tokenHash}:${code}`)
}

function isTokenShaped(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
