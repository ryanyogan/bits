// Passkeys (WebAuthn, decision 030): the server half of registration and
// sign-in, on @simplewebauthn/server (Web Crypto only, so it runs on workerd
// without nodejs_compat).
//
// Each ceremony is two requests. The options step stores a fresh challenge
// in D1 (single use, 10 minutes) and answers JSON for the browser. The
// verify step is a native form POST carrying the browser's JSON response; it
// spends the challenge atomically while verifying, so a response can't be
// replayed and a registration challenge only works for the user it was
// issued to.
import {
  consumePasskeyChallenge,
  findPasskey,
  findUserById,
  insertPasskey,
  insertPasskeyChallenge,
  listPasskeys,
  recordPasskeyUse,
  type D1DataTableDatabase,
  type User,
} from '@bits/db'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

import { platform } from '#platform'

import { APP_TITLE } from '../config.ts'
import { isProduction } from './config.ts'

export const CHALLENGE_TTL_MS = 10 * 60 * 1000
/** How long the browser waits for the authenticator (WebAuthn `timeout`). */
const CEREMONY_TIMEOUT_MS = 5 * 60 * 1000
/** Enough for every device someone owns; stops a script filling the table. */
export const MAX_PASSKEYS = 20
/** EdDSA, ES256, RS256: what platform authenticators and security keys use. */
const ALGORITHMS = [-8, -7, -257]

export interface RelyingParty {
  /** RP ID: the host passkeys are bound to. */
  id: string
  /** The only origin a response may come from. */
  origin: string
}

/**
 * Production binds passkeys to CANONICAL_ORIGIN's host (bits.yogan.dev; the
 * Worker 301s every other host there). Elsewhere it is the browser's own
 * origin: the request's `Origin` header, else its URL. (`wrangler dev`
 * rewrites request URLs to the custom domain, so the header is what knows
 * the page is on localhost.) Development, tests and `pnpm preview` only.
 */
export function relyingParty(url: URL, originHeader: string | null): RelyingParty {
  let canonical = platform.env.CANONICAL_ORIGIN
  if (isProduction && canonical) {
    let origin = new URL(canonical)
    return { id: origin.hostname, origin: origin.origin }
  }
  let source = url
  if (originHeader && originHeader !== 'null') {
    try {
      source = new URL(originHeader)
    } catch {
      // Malformed header: fall back to the URL.
    }
  }
  return { id: source.hostname, origin: source.origin }
}

/** The WebAuthn user handle: the user id's bytes. Stable, so one device keeps one passkey per account. */
function userHandle(user: Pick<User, 'id'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(user.id)
}

export type RegistrationOptionsResult =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; reason: 'too-many' }

/** Options for `navigator.credentials.create()`, for the signed-in user. */
export async function registrationOptions(
  db: D1DataTableDatabase,
  user: User,
  rp: RelyingParty,
): Promise<RegistrationOptionsResult> {
  let existing = await listPasskeys(db, user.id)
  if (existing.length >= MAX_PASSKEYS) return { ok: false, reason: 'too-many' }
  let options = await generateRegistrationOptions({
    rpName: APP_TITLE,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.display_name || user.handle,
    userID: userHandle(user),
    timeout: CEREMONY_TIMEOUT_MS,
    attestationType: 'none',
    // A device that already holds one of this user's passkeys says so
    // instead of making a second.
    excludeCredentials: existing.map((row) => ({ id: row.credential_id, transports: parseTransports(row.transports) })),
    // Discoverable, so sign-in needs no email first; verified, because a
    // passkey alone signs you in.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: ALGORITHMS,
  })
  let now = Date.now()
  await insertPasskeyChallenge(db, {
    challenge: options.challenge,
    purpose: 'register',
    userId: user.id,
    expiresAt: now + CHALLENGE_TTL_MS,
    now,
  })
  return { ok: true, options }
}

export type RegisterResult = { ok: true } | { ok: false; reason: 'invalid' | 'duplicate' | 'too-many' }

/** Verifies `navigator.credentials.create()`'s response and saves the passkey. */
export async function registerPasskey(
  db: D1DataTableDatabase,
  input: { user: User; rp: RelyingParty; response: string; name: string },
): Promise<RegisterResult> {
  let response = parseResponse<RegistrationResponseJSON>(input.response)
  if (!response) return { ok: false, reason: 'invalid' }
  let now = Date.now()
  let verification
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) =>
        consumePasskeyChallenge(db, { challenge, purpose: 'register', userId: input.user.id, now }),
      expectedOrigin: input.rp.origin,
      expectedRPID: input.rp.id,
      requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITHMS,
    })
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!verification.verified) return { ok: false, reason: 'invalid' }
  if ((await listPasskeys(db, input.user.id)).length >= MAX_PASSKEYS) return { ok: false, reason: 'too-many' }

  let info = verification.registrationInfo
  let saved = await insertPasskey(db, {
    credentialId: info.credential.id,
    userId: input.user.id,
    publicKey: isoBase64URL.fromBuffer(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ?? response.response.transports ?? [],
    name: input.name,
    backedUp: info.credentialBackedUp,
    deviceType: info.credentialDeviceType,
    aaguid: info.aaguid,
    now,
  })
  return saved ? { ok: true } : { ok: false, reason: 'duplicate' }
}

/** Options for `navigator.credentials.get()`: discoverable, so no email and no allow-list. */
export async function signInOptions(db: D1DataTableDatabase, rp: RelyingParty): Promise<PublicKeyCredentialRequestOptionsJSON> {
  let options = await generateAuthenticationOptions({
    rpID: rp.id,
    timeout: CEREMONY_TIMEOUT_MS,
    userVerification: 'required',
  })
  let now = Date.now()
  await insertPasskeyChallenge(db, {
    challenge: options.challenge,
    purpose: 'sign-in',
    userId: null,
    expiresAt: now + CHALLENGE_TTL_MS,
    now,
  })
  return options
}

export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'unknown'; credentialId: string }

/**
 * Verifies `navigator.credentials.get()`'s response: a known credential, a
 * signature over this site's unspent challenge by its stored key, user
 * verification, and a counter that moved forward (or stays 0 for synced
 * passkeys). `unknown` means the credential isn't registered here, e.g. it
 * was removed in Settings but is still on the device.
 */
export async function verifyPasskeySignIn(
  db: D1DataTableDatabase,
  input: { rp: RelyingParty; response: string },
): Promise<SignInResult> {
  let response = parseResponse<AuthenticationResponseJSON>(input.response)
  if (!response || typeof response.id !== 'string') return { ok: false, reason: 'invalid' }
  let passkey = await findPasskey(db, response.id)
  if (!passkey) return { ok: false, reason: 'unknown', credentialId: response.id }
  let user = await findUserById(db, passkey.user_id)
  if (!user) return { ok: false, reason: 'unknown', credentialId: response.id }
  // The authenticator returns the user handle stored at registration.
  let handle = response.response?.userHandle
  if (handle && handle !== isoBase64URL.fromBuffer(userHandle(user))) return { ok: false, reason: 'invalid' }

  let now = Date.now()
  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (challenge) => consumePasskeyChallenge(db, { challenge, purpose: 'sign-in', userId: null, now }),
      expectedOrigin: input.rp.origin,
      expectedRPID: input.rp.id,
      credential: {
        id: passkey.credential_id,
        publicKey: isoBase64URL.toBuffer(passkey.public_key),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports),
      },
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!verification.verified) return { ok: false, reason: 'invalid' }
  await recordPasskeyUse(db, {
    credentialId: passkey.credential_id,
    counter: verification.authenticationInfo.newCounter,
    backedUp: verification.authenticationInfo.credentialBackedUp,
    now,
  })
  return { ok: true, user }
}

/** The browser's JSON, size-capped (a real response is 1–2 KB). */
function parseResponse<T>(text: string): T | null {
  if (!text || text.length > 16_384) return null
  try {
    let value: unknown = JSON.parse(text)
    return value && typeof value === 'object' ? (value as T) : null
  } catch {
    return null
  }
}

type Transport = NonNullable<RegistrationResponseJSON['response']['transports']>[number]

function parseTransports(json: string): Transport[] {
  try {
    let value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((item): item is Transport => typeof item === 'string') : []
  } catch {
    return []
  }
}
