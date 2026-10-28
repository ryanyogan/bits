// The Settings page's account reads in one D1 batch (decision 035's pattern,
// decision 045): linked identities, live sessions, passkeys and an open email
// change. They are one `db.batch`, one binding call and one round trip.
//
// The statements name their user through a `UserRef` like the profile's, so
// they can also join the session read later and make `/settings` a single
// round trip.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { D1PreparedStatement, D1Result } from '../d1/types.ts'
import type { IdentityRow, PendingEmailChange, UserSessionSummary } from './auth.ts'
import type { PasskeyRow } from './passkeys.ts'
import type { UserRef } from './profile.ts'

export interface SettingsRows {
  identities: IdentityRow[]
  /** Live sessions, most recently used first (at most 20). */
  sessions: UserSessionSummary[]
  passkeys: PasskeyRow[]
  /** The newest open email change, if any. */
  pendingEmailChange: PendingEmailChange | null
}

/** The four settings statements for `user` at `now`, in the order `settingsRowsFrom` reads them. */
export function settingsStatements(db: D1DataTableDatabase, user: UserRef, now: number): D1PreparedStatement[] {
  // `now` comes after the user's own placeholders.
  let at = `?${user.params.length + 1}`
  let statement = (sql: string, ...extra: unknown[]) => db.d1.prepare(sql).bind(...user.params, ...extra)
  return [
    // Same as listIdentities.
    statement(`select * from identities where user_id = ${user.sql} order by created_at`),
    // Same as listUserSessions.
    statement(
      `select id, user_agent, created_at, last_seen_at from sessions
       where user_id = ${user.sql} and expires_at > ${at} order by last_seen_at desc limit 20`,
      now,
    ),
    // Same as listPasskeys.
    statement(`select * from passkeys where user_id = ${user.sql} order by created_at`),
    // Same as findPendingEmailChange.
    statement(
      `select token_hash, code_hash, email, user_id, attempts, created_at, expires_at from email_tokens
       where user_id = ${user.sql} and purpose = 'email-change' and used_at is null and expires_at > ${at}
       order by created_at desc limit 1`,
      now,
    ),
  ]
}

/** Reads the results of `settingsStatements`, in order. */
export function settingsRowsFrom(results: D1Result<Record<string, unknown>>[]): SettingsRows {
  let [identities, sessions, passkeys, pending] = results.map((result) => result?.results ?? [])
  return {
    identities: identities as unknown as IdentityRow[],
    sessions: sessions as unknown as UserSessionSummary[],
    passkeys: passkeys as unknown as PasskeyRow[],
    pendingEmailChange: ((pending?.[0] as unknown as PendingEmailChange | undefined) ?? null),
  }
}

/** A user's settings rows at `now`, in one batch. */
export async function readSettingsRows(db: D1DataTableDatabase, userId: string, now: number): Promise<SettingsRows> {
  return settingsRowsFrom(await db.batch(settingsStatements(db, { sql: '?1', params: [userId] }, now)))
}
