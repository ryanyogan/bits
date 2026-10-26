// Typed user queries. Take the Database as an argument so callers decide
// where it comes from (request context in the app, a fixture in tests).
import type { Database } from 'remix/data-table'

import { users, type User, type UserRole, type UserRow } from '../tables.ts'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Lowercase, ASCII letters/digits/underscore, 2–32 chars. */
export function normalizeHandle(input: string): string {
  let handle = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
  return handle.length >= 2 ? handle : `${handle}__`.slice(0, 2)
}

function toUser(row: UserRow): User {
  return { ...row, goals: Array.isArray(row.goals) ? (row.goals as string[]) : [] }
}

export async function findUserById(db: Database, id: string): Promise<User | null> {
  let row = await db.find(users, id)
  return row ? toUser(row) : null
}

export async function findUserByEmail(db: Database, email: string): Promise<User | null> {
  let row = await db.findOne(users, { where: { email: normalizeEmail(email) } })
  return row ? toUser(row) : null
}

export async function findUserByHandle(db: Database, handle: string): Promise<User | null> {
  let row = await db.findOne(users, { where: { handle: handle.toLowerCase() } })
  return row ? toUser(row) : null
}

export interface CreateUserInput {
  email: string
  displayName?: string
  /** Defaults to one derived from the display name or email. Must be unique. */
  handle?: string
  role?: UserRole
  goals?: string[]
  timezone?: string
  emailVerifiedAt?: number | null
}

/**
 * Inserts a user. Handle uniqueness is enforced by the database; callers that
 * derive a handle should retry with a suffix on a unique-constraint error.
 */
export async function createUser(db: Database, input: CreateUserInput): Promise<User> {
  let email = normalizeEmail(input.email)
  let displayName = input.displayName?.trim() ?? ''
  let row = await db.create(
    users,
    {
      id: crypto.randomUUID(),
      email,
      email_verified_at: input.emailVerifiedAt ?? null,
      display_name: displayName,
      handle: normalizeHandle(input.handle ?? (displayName || email.split('@')[0]!)),
      avatar: null,
      role: input.role ?? 'learner',
      goals: input.goals ?? [],
      timezone: input.timezone ?? 'UTC',
      xp_total: 0,
      is_public: true,
    },
    { returnRow: true },
  )
  return toUser(row)
}
