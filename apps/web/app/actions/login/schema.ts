import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

/** Only same-origin paths may be used as a post-login destination. */
export function safeNextPath(value: string | undefined | null): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  // Browsers drop tabs and newlines and read `\` as `/`, so `/\t/evil.example`
  // could still leave the site. Refuse them, then let URL decide the origin.
  if (/[\\\s\x00-\x1f\x7f]/.test(value)) return undefined
  let base = 'https://bits.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return undefined
  }
  if (url.origin !== base) return undefined
  let path = url.pathname + url.search + url.hash
  // Dot segments can normalise `/.//evil.example` into `//evil.example`.
  return path.startsWith('//') ? undefined : path
}

const trimmed = s.defaulted(s.string(), '').transform((value) => value.trim())

export const loginModes = ['signin', 'signup'] as const
export type LoginMode = (typeof loginModes)[number]

/** "What brings you here?" on sign-up (Auth spec, state B). */
export const signupGoals = [
  { id: 'curious', label: 'Curious about AI' },
  { id: 'work', label: 'Use AI at work' },
  { id: 'code', label: 'Build with code' },
  { id: 'teach', label: 'Teach others' },
] as const
export type SignupGoal = (typeof signupGoals)[number]['id']
const goalIds = signupGoals.map((goal) => goal.id) as [SignupGoal, ...SignupGoal[]]

/** POST /login: request a magic link + 6-digit code. */
export const loginForm = f.object({
  email: f.field(
    s
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(checks.email(), checks.maxLength(254)),
  ),
  mode: f.field(s.defaulted(s.enum_(loginModes), 'signin')),
  displayName: f.field(trimmed.pipe(checks.maxLength(60))),
  goals: f.fields(s.array(s.enum_(goalIds))),
  /** IANA zone filled in by the browser (TimezoneField); stored at sign-up. */
  timezone: f.field(trimmed.pipe(checks.maxLength(64))),
  next: f.field(s.defaulted(s.string(), '').transform(safeNextPath)),
})

/** POST /auth/verify: the 6-digit code from the email. */
export const verifyCodeForm = f.object({
  email: f.field(
    s
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(checks.email()),
  ),
  code: f.field(
    s
      .string()
      .transform((value) => value.replace(/\s+/g, ''))
      .refine((value) => /^\d{6}$/.test(value), 'Enter the 6-digit code from the email.'),
  ),
})

export type FormIssue = { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }

export function issueField(issue: FormIssue): PropertyKey | undefined {
  let first = issue.path?.[0]
  return typeof first === 'object' && first !== null ? first.key : first
}

export function issueFor(issues: readonly FormIssue[] | undefined, name: string) {
  return issues?.find((issue) => issueField(issue) === name)
}

export function readText(formData: FormData | undefined, name: string): string {
  let value = formData?.get(name)
  return typeof value === 'string' ? value : ''
}

export function readGoals(formData: FormData | undefined): SignupGoal[] {
  let ids: readonly string[] = goalIds
  return (formData?.getAll('goals') ?? []).filter(
    (value): value is SignupGoal => typeof value === 'string' && ids.includes(value),
  )
}
