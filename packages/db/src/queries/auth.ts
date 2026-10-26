// Sessions, email sign-in tokens and OAuth identities.
//
// Auth-critical writes use explicit SQL on the D1 binding so the single-use
// and conditional semantics are visible in one statement each. Callers hash
// every secret before it reaches these functions (see decision 015).
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { OAuthProvider } from '../tables.ts'

// ---------------------------------------------------------------------------
// Sessions (the D1 store behind remix/session)

export interface StoredSession {
  /** JSON `[values, flash]`. */
  data: string
  user_id: string | null
  last_seen_at: number
}

/** Reads an unexpired session row by the hash of its id. */
export async function readSession(
  db: D1DataTableDatabase,
  idHash: string,
  now: number,
): Promise<StoredSession | null> {
  return db.d1
    .prepare('select data, user_id, last_seen_at from sessions where id = ? and expires_at > ?')
    .bind(idHash, now)
    .first<StoredSession>()
}

export interface SaveSessionInput {
  idHash: string
  userId: string | null
  data: string
  userAgent: string | null
  expiresAt: number
  now: number
}

/** Inserts or replaces a session row, keeping its created_at and user agent. */
export async function saveSession(db: D1DataTableDatabase, input: SaveSessionInput): Promise<void> {
  await db.d1
    .prepare(
      `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       on conflict (id) do update set
         user_id = excluded.user_id,
         data = excluded.data,
         user_agent = coalesce(excluded.user_agent, sessions.user_agent),
         expires_at = excluded.expires_at,
         last_seen_at = excluded.last_seen_at`,
    )
    .bind(input.idHash, input.userId, input.data, input.userAgent, input.expiresAt, input.now)
    .run()
}

export async function deleteSession(db: D1DataTableDatabase, idHash: string): Promise<void> {
  await db.d1.prepare('delete from sessions where id = ?').bind(idHash).run()
}

/** Signs a user out everywhere. Returns how many sessions were removed. */
export async function deleteUserSessions(db: D1DataTableDatabase, userId: string): Promise<number> {
  let result = await db.d1.prepare('delete from sessions where user_id = ?').bind(userId).run()
  return result.meta.changes ?? 0
}

export interface UserSessionSummary {
  id: string
  user_agent: string | null
  created_at: number
  last_seen_at: number
}

/** A user's live sessions, most recently used first. */
export async function listUserSessions(
  db: D1DataTableDatabase,
  userId: string,
  now: number,
): Promise<UserSessionSummary[]> {
  let result = await db.d1
    .prepare(
      `select id, user_agent, created_at, last_seen_at from sessions
       where user_id = ? and expires_at > ? order by last_seen_at desc limit 20`,
    )
    .bind(userId, now)
    .all<UserSessionSummary>()
  return result.results
}

/** Housekeeping for the scheduled handler: drops expired sessions and tokens. */
export async function deleteExpiredAuthRows(db: D1DataTableDatabase, now: number): Promise<void> {
  await db.batch([
    db.d1.prepare('delete from sessions where expires_at <= ?').bind(now),
    // Keep spent tokens for an hour so the per-email and per-IP limits still count them.
    db.d1.prepare('delete from email_tokens where expires_at <= ?').bind(now - 60 * 60 * 1000),
  ])
}

// ---------------------------------------------------------------------------
// Email sign-in tokens

export interface EmailTokenInput {
  tokenHash: string
  codeHash: string
  email: string
  ipHash: string | null
  /** JSON object text, or null for sign-in. */
  signup: string | null
  nextPath: string | null
  expiresAt: number
  now: number
}

export async function insertEmailToken(db: D1DataTableDatabase, input: EmailTokenInput): Promise<void> {
  await db.d1
    .prepare(
      `insert into email_tokens
         (token_hash, code_hash, email, attempts, expires_at, used_at, next_path, created_at, ip_hash, signup)
       values (?, ?, ?, 0, ?, null, ?, ?, ?, ?)`,
    )
    .bind(
      input.tokenHash,
      input.codeHash,
      input.email,
      input.expiresAt,
      input.nextPath,
      input.now,
      input.ipHash,
      input.signup,
    )
    .run()
}

/** Emails sent to this address since `since` (per-email rate limit). */
export async function countEmailTokensForEmail(db: D1DataTableDatabase, email: string, since: number) {
  let row = await db.d1
    .prepare('select count(*) as n from email_tokens where email = ? and created_at > ?')
    .bind(email, since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** Emails requested from this IP since `since` (per-IP rate limit). */
export async function countEmailTokensForIp(db: D1DataTableDatabase, ipHash: string, since: number) {
  let row = await db.d1
    .prepare('select count(*) as n from email_tokens where ip_hash = ? and created_at > ?')
    .bind(ipHash, since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

export interface OpenEmailToken {
  token_hash: string
  code_hash: string
  email: string
  attempts: number
  next_path: string | null
  signup: string | null
}

/**
 * Unused, unexpired tokens for an email that still have code attempts left,
 * newest first. A learner who asked twice can type the code from either email.
 */
export async function listOpenEmailTokens(
  db: D1DataTableDatabase,
  email: string,
  now: number,
  maxAttempts: number,
): Promise<OpenEmailToken[]> {
  let result = await db.d1
    .prepare(
      `select token_hash, code_hash, email, attempts, next_path, signup from email_tokens
       where email = ? and used_at is null and expires_at > ? and attempts < ?
       order by created_at desc limit 3`,
    )
    .bind(email, now, maxAttempts)
    .all<OpenEmailToken>()
  return result.results
}

/** Counts one wrong code against each token the learner could have meant. */
export async function bumpEmailTokenAttempts(db: D1DataTableDatabase, tokenHashes: string[]): Promise<void> {
  if (tokenHashes.length === 0) return
  await db.batch(
    tokenHashes.map((hash) =>
      db.d1.prepare('update email_tokens set attempts = attempts + 1 where token_hash = ?').bind(hash),
    ),
  )
}

/**
 * Marks a token used if it is still open and returns it. Exactly one caller
 * wins a race for the same token; everyone else gets null.
 */
export async function consumeEmailToken(
  db: D1DataTableDatabase,
  tokenHash: string,
  now: number,
): Promise<OpenEmailToken | null> {
  return db.d1
    .prepare(
      `update email_tokens set used_at = ?1
       where token_hash = ?2 and used_at is null and expires_at > ?1
       returning token_hash, code_hash, email, attempts, next_path, signup`,
    )
    .bind(now, tokenHash)
    .first<OpenEmailToken>()
}

/** Looks up an open token without spending it (the link confirmation page). */
export async function peekEmailToken(
  db: D1DataTableDatabase,
  tokenHash: string,
  now: number,
): Promise<OpenEmailToken | null> {
  return db.d1
    .prepare(
      `select token_hash, code_hash, email, attempts, next_path, signup from email_tokens
       where token_hash = ? and used_at is null and expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<OpenEmailToken>()
}

// ---------------------------------------------------------------------------
// OAuth identities

export interface IdentityRow {
  provider: OAuthProvider
  provider_user_id: string
  user_id: string
  email: string | null
  created_at: number
}

export async function findIdentity(
  db: D1DataTableDatabase,
  provider: OAuthProvider,
  providerUserId: string,
): Promise<IdentityRow | null> {
  return db.d1
    .prepare('select * from identities where provider = ? and provider_user_id = ?')
    .bind(provider, providerUserId)
    .first<IdentityRow>()
}

export async function listIdentities(db: D1DataTableDatabase, userId: string): Promise<IdentityRow[]> {
  let result = await db.d1
    .prepare('select * from identities where user_id = ? order by created_at')
    .bind(userId)
    .all<IdentityRow>()
  return result.results
}

export async function linkIdentity(
  db: D1DataTableDatabase,
  input: { provider: OAuthProvider; providerUserId: string; userId: string; email: string | null; now: number },
): Promise<void> {
  await db.d1
    .prepare(
      `insert into identities (provider, provider_user_id, user_id, email, created_at)
       values (?, ?, ?, ?, ?)`,
    )
    .bind(input.provider, input.providerUserId, input.userId, input.email, input.now)
    .run()
}

export async function unlinkIdentity(
  db: D1DataTableDatabase,
  userId: string,
  provider: OAuthProvider,
): Promise<number> {
  let result = await db.d1
    .prepare('delete from identities where user_id = ? and provider = ?')
    .bind(userId, provider)
    .run()
  return result.meta.changes ?? 0
}
