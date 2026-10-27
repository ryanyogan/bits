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
export function decodeJsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    let parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function decodeBoolean(value: unknown): unknown {
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
    /** Consecutive local days with activity, ending on streak_last_day. */
    streak_days: c.integer(),
    /** YYYY-MM-DD in the user's timezone; null before any activity. */
    streak_last_day: c.text().nullable(),
    best_streak: c.integer(),
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
    /** SHA-256 hex of the session id in the signed cookie. */
    id: c.text(),
    /** Null until the browser signs in. */
    user_id: c.text().nullable(),
    /** remix/session data, JSON `[values, flash]`. */
    data: c.text(),
    user_agent: c.text().nullable(),
    expires_at: c.integer(),
    created_at: c.integer(),
    last_seen_at: c.integer(),
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
    /** SHA-256 hex of the requesting IP (per-IP rate limit). */
    ip_hash: c.text().nullable(),
    /** Sign-up answers as JSON text, applied when the user row is created. */
    signup: c.text().nullable(),
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

export const lessonProgress = table({
  name: 'lesson_progress',
  primaryKey: ['user_id', 'course_id', 'lesson_slug'],
  columns: {
    user_id: c.text(),
    course_id: c.text(),
    lesson_slug: c.text(),
    started_at: c.integer(),
    completed_at: c.integer().nullable(),
    updated_at: c.integer(),
  },
})

export type LessonProgress = TableRow<typeof lessonProgress>

export const attemptSources = ['submit', 'live', 'example', 'fallback'] as const
/**
 * submit: saved with "Complete lesson". live: the model ran. example: canned
 * output for a temperature the model doesn't run at. fallback: canned output
 * because of a limit, the budget or an outage (decision 019).
 */
export type AttemptSource = (typeof attemptSources)[number]

/** The prompt journal: every run and every submitted prompt (migration 0005). */
export const exerciseAttempts = table({
  name: 'exercise_attempts',
  columns: {
    id: c.text(),
    user_id: c.text().nullable(),
    /** Session-held id of a signed-out visitor. */
    visitor: c.text().nullable(),
    ip_hash: c.text().nullable(),
    course_id: c.text(),
    lesson_slug: c.text(),
    exercise_id: c.text(),
    prompt: c.text(),
    source: c.enum(attemptSources),
    /** T × 100 of a run; null for a submission. */
    temperature: c.integer().nullable(),
    output: c.text(),
    model: c.text().nullable(),
    input_tokens: c.integer(),
    output_tokens: c.integer(),
    /** Submissions only: every check passed. */
    passed: c.boolean().nullable(),
    created_at: c.integer(),
  },
  afterRead({ value }) {
    let next = { ...value }
    if ('passed' in next && next.passed != null) next.passed = decodeBoolean(next.passed) as boolean
    return { value: next }
  },
})

export type ExerciseAttempt = TableRow<typeof exerciseAttempts>

export const xpKinds = ['exercise', 'quiz', 'lesson'] as const
export type XpKind = (typeof xpKinds)[number]

export const xpEvents = table({
  name: 'xp_events',
  columns: {
    id: c.text(),
    user_id: c.text(),
    kind: c.enum(xpKinds),
    ref: c.text(),
    xp: c.integer(),
    day: c.text(),
    created_at: c.integer(),
  },
})

export type XpEvent = TableRow<typeof xpEvents>

export const activityDays = table({
  name: 'activity_days',
  primaryKey: ['user_id', 'day'],
  columns: {
    user_id: c.text(),
    day: c.text(),
    xp: c.integer(),
    actions: c.integer(),
  },
})

export type ActivityDay = TableRow<typeof activityDays>

export const userBadges = table({
  name: 'user_badges',
  primaryKey: ['user_id', 'badge_id'],
  columns: {
    user_id: c.text(),
    badge_id: c.text(),
    awarded_at: c.integer(),
  },
})

export type UserBadge = TableRow<typeof userBadges>

// Course content (migration 0004, decision 018). Compiled JSON lives in R2;
// these rows index it: the live pointer, every build with its report, and
// who may publish.
export const courses = table({
  name: 'courses',
  primaryKey: 'slug',
  columns: {
    slug: c.text(),
    title: c.text(),
    track: c.text().nullable(),
    sort: c.integer(),
    /** course_versions.id of the live version; null until first published. */
    current_version_id: c.text().nullable(),
    /** The first uploader; set on insert only. Null for CLI-created courses. */
    owner_id: c.text().nullable(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
})

export type Course = TableRow<typeof courses>

export const validationLevels = ['ok', 'warning', 'error'] as const
export type ValidationLevel = (typeof validationLevels)[number]

/** One line of a build's validation report. */
export interface ReportItem {
  level: ValidationLevel
  text: string
  /** Path inside the course folder, e.g. `06-temperature.md`. */
  file?: string
  /** 1-based line in `file`. */
  line?: number
}

/** building: R2 upload in progress; ready: may go live; failed: has errors, nothing in R2. */
export const versionStatuses = ['building', 'ready', 'failed'] as const
export type VersionStatus = (typeof versionStatuses)[number]

export const courseVersions = table({
  name: 'course_versions',
  columns: {
    id: c.text(),
    course_slug: c.text(),
    n: c.integer(),
    status: c.enum(versionStatuses),
    errors: c.integer(),
    warnings: c.integer(),
    report: c.json(),
    files: c.integer(),
    source: c.text(),
    created_by: c.text().nullable(),
    created_at: c.integer(),
    published_at: c.integer().nullable(),
  },
  afterRead({ value }) {
    if (!('report' in value)) return { value }
    return { value: { ...value, report: decodeJsonArray(value.report) } }
  },
})

export type CourseVersion = Omit<TableRow<typeof courseVersions>, 'report'> & { report: ReportItem[] }

export const courseAuthors = table({
  name: 'course_authors',
  primaryKey: ['course_slug', 'user_id'],
  columns: {
    course_slug: c.text(),
    user_id: c.text(),
    created_at: c.integer(),
  },
})

export type CourseAuthor = TableRow<typeof courseAuthors>
