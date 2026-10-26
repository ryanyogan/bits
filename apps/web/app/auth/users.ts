// Turning a verified sign-in into a user and a session.
import {
  availableHandle,
  createUser,
  findIdentity,
  findUserByEmail,
  findUserById,
  linkIdentity,
  markEmailVerified,
  normalizeEmail,
  type D1DataTableDatabase,
  type OAuthProvider,
  type User,
} from '@bits/db'
import { completeAuth } from 'remix/auth'
import type { RequestContext } from 'remix/router'

import { getDatabase } from '../middleware/database.ts'
import { mergeAnonymousProgress } from '../progress/progress.ts'
import { USER_KEY, type SignInMethod, type UserRecord } from './session.ts'

/** Sign-up answers collected before the email is verified. */
export interface SignupDetails {
  displayName?: string
  goals?: string[]
  timezone?: string
}

export function parseSignup(json: string | null): SignupDetails | null {
  if (!json) return null
  try {
    let value = JSON.parse(json) as SignupDetails
    return typeof value === 'object' && value !== null ? value : null
  } catch {
    return null
  }
}

/**
 * The user for a verified email: existing users get their email marked
 * verified; new users are created with the sign-up answers, if any.
 */
export async function userForVerifiedEmail(
  db: D1DataTableDatabase,
  email: string,
  signup: SignupDetails | null,
): Promise<{ user: User; created: boolean }> {
  let now = Date.now()
  let existing = await findUserByEmail(db, email)
  if (existing) {
    let user = existing.email_verified_at ? existing : await markEmailVerified(db, existing.id, now)
    return { user, created: false }
  }
  return createVerifiedUser(db, { email, displayName: signup?.displayName, signup })
}

async function createVerifiedUser(
  db: D1DataTableDatabase,
  input: { email: string; displayName?: string; handleHint?: string; signup: SignupDetails | null },
): Promise<{ user: User; created: boolean }> {
  let email = normalizeEmail(input.email)
  let displayName = input.displayName?.trim().slice(0, 60) ?? ''
  try {
    let user = await createUser(db, {
      email,
      displayName,
      handle: await availableHandle(db, input.handleHint || displayName || email.split('@')[0]!),
      goals: input.signup?.goals ?? [],
      timezone: validTimezone(input.signup?.timezone),
      emailVerifiedAt: Date.now(),
    })
    return { user, created: true }
  } catch (error) {
    // Lost a race with another sign-in for the same email: use that row.
    let raced = await findUserByEmail(db, email)
    if (raced) return { user: raced, created: false }
    throw error
  }
}

export type OAuthProfile = {
  provider: OAuthProvider
  providerUserId: string
  /** Only a provider-verified email; null otherwise. */
  email: string | null
  name: string | null
  /** e.g. the GitHub login, used as the handle hint for new users. */
  username: string | null
}

export type OAuthUserResult =
  | { ok: true; user: User; created: boolean; linked: boolean }
  | { ok: false; reason: 'no-email' | 'taken' }

/**
 * Resolves an OAuth sign-in (handoff, account linking): a known identity
 * signs in its user; otherwise the identity links to the signed-in user, or
 * to the user with the same verified email, or to a new user.
 */
export async function userForOAuth(
  db: D1DataTableDatabase,
  profile: OAuthProfile,
  signedIn: User | null,
): Promise<OAuthUserResult> {
  let now = Date.now()
  let identity = await findIdentity(db, profile.provider, profile.providerUserId)
  if (identity) {
    if (signedIn && identity.user_id !== signedIn.id) return { ok: false, reason: 'taken' }
    let user = await findUserById(db, identity.user_id)
    if (user) return { ok: true, user, created: false, linked: false }
  }

  let link = (user: User) =>
    linkIdentity(db, {
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      userId: user.id,
      email: profile.email,
      now,
    })

  if (signedIn) {
    await link(signedIn)
    return { ok: true, user: signedIn, created: false, linked: true }
  }

  if (!profile.email) return { ok: false, reason: 'no-email' }
  let existing = await findUserByEmail(db, profile.email)
  let { user, created } = existing
    ? { user: existing.email_verified_at ? existing : await markEmailVerified(db, existing.id, now), created: false }
    : await createVerifiedUser(db, {
        email: profile.email,
        displayName: profile.name ?? undefined,
        handleHint: profile.username ?? undefined,
        signup: null,
      })
  await link(user)
  return { ok: true, user, created, linked: true }
}

/**
 * Starts the signed-in session: rotates the session id (remix/auth
 * `completeAuth`, which also deletes the old row) and stores the user record.
 */
export async function startUserSession(context: RequestContext<any, any>, user: User, method: SignInMethod): Promise<void> {
  let session = completeAuth(context)
  // Lessons finished while signed out move into the account (decision 016).
  await mergeAnonymousProgress(getDatabase(context), session, user)
  let now = Date.now()
  let record: UserRecord = {
    userId: user.id,
    method,
    at: now,
    seenAt: now,
    ua: context.headers.get('User-Agent')?.slice(0, 256) ?? null,
  }
  session.set(USER_KEY, record)
}

function validTimezone(value: string | undefined): string {
  if (!value) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return value
  } catch {
    return 'UTC'
  }
}
