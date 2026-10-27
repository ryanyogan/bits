// Account data for Settings (docs/design/spec/pages/Settings.md), read from
// D1: linked identities, passkeys, live sessions and an open email change.
import {
  findPendingEmailChange,
  listIdentities,
  listPasskeys,
  listUserSessions,
  type D1DataTableDatabase,
  type PasskeyRow,
  type User,
} from '@bits/db'

import { sha256Hex } from '../../auth/crypto.ts'

export type MethodKind = 'email' | 'github' | 'google' | 'passkey'

export interface SignInMethod {
  /** Stable id used by the remove/disconnect forms. */
  id: string
  kind: MethodKind
  name: string
  /** Mono meta line; empty when not connected. */
  meta: string
  connected: boolean
}

export interface SessionRow {
  label: string
  when: string
  current?: boolean
}

export interface AccountSettings {
  verified: boolean
  /** The new address an open email change waits on (Settings §2, check your inbox). */
  pendingEmail: string | null
  methods: SignInMethod[]
  sessions: SessionRow[]
  export: { size: string; prompts: number }
}

export async function getAccountSettings(
  db: D1DataTableDatabase,
  user: User,
  currentSessionId: string,
): Promise<AccountSettings> {
  let now = Date.now()
  let [identities, sessions, currentHash, passkeys, pending] = await Promise.all([
    listIdentities(db, user.id),
    listUserSessions(db, user.id, now),
    sha256Hex(currentSessionId),
    listPasskeys(db, user.id),
    findPendingEmailChange(db, user.id, now),
  ])
  let provider = (kind: 'github' | 'google', name: string): SignInMethod => {
    let identity = identities.find((row) => row.provider === kind)
    return {
      id: kind,
      kind,
      name,
      meta: identity ? [identity.email, `connected ${monthYear(identity.created_at)}`].filter(Boolean).join(' · ') : '',
      connected: Boolean(identity),
    }
  }
  return {
    verified: user.email_verified_at != null,
    pendingEmail: pending?.email ?? null,
    methods: [
      { id: 'email', kind: 'email', name: 'Email link + code', meta: user.email, connected: true },
      provider('github', 'GitHub'),
      provider('google', 'Google'),
      ...passkeys.map(
        (row): SignInMethod => ({
          id: row.credential_id,
          kind: 'passkey',
          name: row.name || 'Passkey',
          meta: passkeyMeta(row, now),
          connected: true,
        }),
      ),
    ],
    sessions: sessions.map((session) => ({
      label: deviceLabel(session.user_agent),
      when: session.id === currentHash ? 'active now' : relativeTime(session.last_seen_at, now),
      current: session.id === currentHash,
    })),
    // Progress and the prompt journal join the export with progress tracking.
    export: { size: 'Under 1 KB', prompts: 0 },
  }
}

/** "Chrome on macOS" from a user agent, or a generic label. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  let browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'
  let os = /iPhone|iPad/.test(userAgent)
    ? 'iPhone'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  return os ? `${browser} on ${os}` : browser
}

function relativeTime(at: number, now: number): string {
  let minutes = Math.round((now - at) / 60_000)
  if (minutes < 5) return 'active now'
  if (minutes < 60) return `${minutes} minutes ago`
  let hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  let days = Math.round(hours / 24)
  if (days < 14) return days === 1 ? 'yesterday' : `${days} days ago`
  return `${Math.round(days / 7)} weeks ago`
}

/** `synced · added 12 Oct 2026 · last used today` (Settings §3). */
export function passkeyMeta(row: Pick<PasskeyRow, 'backed_up' | 'created_at' | 'last_used_at'>, now: number): string {
  let added = new Date(row.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  let used = row.last_used_at == null ? 'not used yet' : `last used ${relativeDay(row.last_used_at, now)}`
  return [row.backed_up ? 'synced' : 'this device only', `added ${added}`, used].join(' · ')
}

function relativeDay(at: number, now: number): string {
  let days = Math.floor((now - at) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.round(days / 7)} weeks ago`
}

function monthYear(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
