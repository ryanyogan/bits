// Typed user queries. Take the Database as an argument so callers decide
// where it comes from (request context in the app, a fixture in tests).
import type { Database } from 'remix/data-table'

import type { D1DataTableDatabase } from '../d1/database.ts'
import { decodeBoolean, decodeJsonArray, users, type LessonDepth, type User, type UserRole, type UserRow } from '../tables.ts'

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

/** A raw `select * from users` row (D1 types: 0/1, JSON text) as a User, like data-table's afterRead. */
export function userFromRawRow(row: Record<string, unknown>): User {
  return toUser({ ...row, goals: decodeJsonArray(row.goals), is_public: decodeBoolean(row.is_public) } as UserRow)
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

/** Handles that would read as official or collide with app words. */
export const reservedHandles = new Set(['admin', 'bits', 'me', 'settings', 'author', 'support', 'help', 'api', 'root'])

/**
 * Picks a free handle from a name or email: the normalized base if it is
 * free, otherwise the base plus a short random number.
 */
export async function availableHandle(db: Database, source: string): Promise<string> {
  let base = normalizeHandle(source).slice(0, 27)
  for (let attempt = 0; attempt < 6; attempt++) {
    let candidate = attempt === 0 ? base : `${base}_${randomDigits(attempt < 3 ? 2 : 4)}`
    if (reservedHandles.has(candidate)) continue
    if (!(await findUserByHandle(db, candidate))) return candidate
  }
  return `${base}_${randomDigits(6)}`
}

function randomDigits(length: number): string {
  let bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => String(byte % 10)).join('')
}

export async function markEmailVerified(db: Database, userId: string, at: number): Promise<User> {
  return toUser(await db.update(users, userId, { email_verified_at: at }))
}

/**
 * Saves the learner's lesson depth (decision 053). One statement, and a
 * no-op when it already holds `depth`. Resolves true when a row changed.
 */
export async function saveLessonDepth(db: D1DataTableDatabase, userId: string, depth: LessonDepth): Promise<boolean> {
  let result = await db.d1
    .prepare('update users set lesson_depth = ?2 where id = ?1 and lesson_depth is not ?2')
    .bind(userId, depth)
    .run()
  return (result.meta?.changes ?? 0) > 0
}
