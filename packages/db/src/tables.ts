// remix/data-table definitions for the D1 schema.
//
// Keep these aligned with ../migrations/*.sql: `table()` describes rows for
// typed queries, it does not create SQL tables. When a migration changes a
// table, change its definition here in the same commit.
import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const userRoles = ['learner', 'author', 'admin'] as const
export type UserRole = (typeof userRoles)[number]

export const oauthProviders = ['github', 'google'] as const
export type OAuthProvider = (typeof oauthProviders)[number]

// D1 stores booleans as 0/1 and JSON as text. The driver encodes on write;
// these afterRead hooks decode on read so rows come back as their TS types.
function decodeJsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    let parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function decodeBoolean(value: unknown): unknown {
  return typeof value === 'number' ? value !== 0 : value
}

export const users = table({
  name: 'users',
  columns: {
    id: c.text(),
    email: c.text(),
    email_verified_at: c.integer().nullable(),
    display_name: c.text(),
    handle: c.text(),
    avatar: c.text().nullable(),
    role: c.enum(userRoles),
    goals: c.json(),
    timezone: c.text(),
    xp_total: c.integer(),
    is_public: c.boolean(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  timestamps: true,
  afterRead({ value }) {
    let next = { ...value }
    if ('goals' in next) next.goals = decodeJsonArray(next.goals)
    if ('is_public' in next) next.is_public = decodeBoolean(next.is_public) as boolean
    return { value: next }
  },
})

export type UserRow = TableRow<typeof users>
/** A user as the app sees it: goals is always a string array. */
export type User = Omit<UserRow, 'goals'> & { goals: string[] }

export const identities = table({
  name: 'identities',
  primaryKey: ['provider', 'provider_user_id'],
  columns: {
    provider: c.enum(oauthProviders),
    provider_user_id: c.text(),
    user_id: c.text(),
    email: c.text().nullable(),
    created_at: c.integer(),
  },
})

export type Identity = TableRow<typeof identities>

export const sessions = table({
  name: 'sessions',
  columns: {
    /** SHA-256 hex of the opaque cookie token. */
    id: c.text(),
    user_id: c.text(),
    expires_at: c.integer(),
    created_at: c.integer(),
    last_seen_at: c.integer(),
    user_agent: c.text().nullable(),
  },
})

export type Session = TableRow<typeof sessions>

export const emailTokens = table({
  name: 'email_tokens',
  primaryKey: 'token_hash',
  columns: {
    token_hash: c.text(),
    code_hash: c.text(),
    email: c.text(),
    attempts: c.integer(),
    expires_at: c.integer(),
    used_at: c.integer().nullable(),
    next_path: c.text().nullable(),
    created_at: c.integer(),
  },
})

export type EmailToken = TableRow<typeof emailTokens>

export const passkeys = table({
  name: 'passkeys',
  primaryKey: 'credential_id',
  columns: {
    credential_id: c.text(),
    user_id: c.text(),
    public_key: c.text(),
    counter: c.integer(),
    transports: c.json(),
    name: c.text().nullable(),
    created_at: c.integer(),
    last_used_at: c.integer().nullable(),
  },
  afterRead({ value }) {
    if (!('transports' in value)) return { value }
    return { value: { ...value, transports: decodeJsonArray(value.transports) } }
  },
})

export type Passkey = TableRow<typeof passkeys>
