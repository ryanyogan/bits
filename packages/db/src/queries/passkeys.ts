// Passkeys (WebAuthn credentials) and their single-use challenges
// (decision 030). Credential ids and public keys are base64url text.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { PasskeyChallengePurpose } from '../tables.ts'

// ---------------------------------------------------------------------------
// Challenges

export interface ChallengeInput {
  challenge: string
  purpose: PasskeyChallengePurpose
  /** The signed-in user a registration challenge is for; null for sign-in. */
  userId: string | null
  expiresAt: number
  now: number
}

/** Stores a challenge, and sweeps expired ones in the same batch. */
export async function insertPasskeyChallenge(db: D1DataTableDatabase, input: ChallengeInput): Promise<void> {
  await db.batch([
    db.d1.prepare('delete from webauthn_challenges where expires_at <= ?').bind(input.now),
    db.d1
      .prepare(
        `insert into webauthn_challenges (challenge, purpose, user_id, expires_at, created_at)
         values (?, ?, ?, ?, ?)`,
      )
      .bind(input.challenge, input.purpose, input.userId, input.expiresAt, input.now),
  ])
}

/**
 * Spends a challenge: true for exactly one caller, and only while it is
 * unexpired and was issued for this purpose (and this user).
 */
export async function consumePasskeyChallenge(
  db: D1DataTableDatabase,
  input: { challenge: string; purpose: PasskeyChallengePurpose; userId: string | null; now: number },
): Promise<boolean> {
  let row = await db.d1
    .prepare(
      `delete from webauthn_challenges
       where challenge = ?1 and purpose = ?2 and user_id is ?3 and expires_at > ?4
       returning challenge`,
    )
    .bind(input.challenge, input.purpose, input.userId, input.now)
    .first<{ challenge: string }>()
  return row != null
}

// ---------------------------------------------------------------------------
// Credentials

export interface PasskeyRow {
  credential_id: string
  user_id: string
  public_key: string
  counter: number
  /** JSON array text. */
  transports: string
  name: string | null
  created_at: number
  last_used_at: number | null
  /** 0 or 1. */
  backed_up: number
  device_type: string | null
  aaguid: string | null
}

export async function listPasskeys(db: D1DataTableDatabase, userId: string): Promise<PasskeyRow[]> {
  let result = await db.d1
    .prepare('select * from passkeys where user_id = ? order by created_at')
    .bind(userId)
    .all<PasskeyRow>()
  return result.results
}

export async function findPasskey(db: D1DataTableDatabase, credentialId: string): Promise<PasskeyRow | null> {
  return db.d1.prepare('select * from passkeys where credential_id = ?').bind(credentialId).first<PasskeyRow>()
}

export interface NewPasskey {
  credentialId: string
  userId: string
  publicKey: string
  counter: number
  transports: string[]
  name: string
  backedUp: boolean
  deviceType: string
  aaguid: string
  now: number
}

/** False when the credential id is already registered (to anyone). */
export async function insertPasskey(db: D1DataTableDatabase, input: NewPasskey): Promise<boolean> {
  let result = await db.d1
    .prepare(
      `insert into passkeys
         (credential_id, user_id, public_key, counter, transports, name, created_at, last_used_at, backed_up, device_type, aaguid)
       values (?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)
       on conflict (credential_id) do nothing`,
    )
    .bind(
      input.credentialId,
      input.userId,
      input.publicKey,
      input.counter,
      JSON.stringify(input.transports),
      input.name,
      input.now,
      input.backedUp ? 1 : 0,
      input.deviceType,
      input.aaguid,
    )
    .run()
  return (result.meta.changes ?? 0) > 0
}

/** After a verified sign-in: the new signature counter, backup state and time. */
export async function recordPasskeyUse(
  db: D1DataTableDatabase,
  input: { credentialId: string; counter: number; backedUp: boolean; now: number },
): Promise<void> {
  await db.d1
    .prepare('update passkeys set counter = ?, backed_up = ?, last_used_at = ? where credential_id = ?')
    .bind(input.counter, input.backedUp ? 1 : 0, input.now, input.credentialId)
    .run()
}

/** Renames one of the user's passkeys. False when it isn't theirs. */
export async function renamePasskey(
  db: D1DataTableDatabase,
  userId: string,
  credentialId: string,
  name: string,
): Promise<boolean> {
  let result = await db.d1
    .prepare('update passkeys set name = ? where credential_id = ? and user_id = ?')
    .bind(name, credentialId, userId)
    .run()
  return (result.meta.changes ?? 0) > 0
}

/** Deletes one of the user's passkeys. False when it isn't theirs. */
export async function deletePasskey(db: D1DataTableDatabase, userId: string, credentialId: string): Promise<boolean> {
  let result = await db.d1
    .prepare('delete from passkeys where credential_id = ? and user_id = ?')
    .bind(credentialId, userId)
    .run()
  return (result.meta.changes ?? 0) > 0
}
