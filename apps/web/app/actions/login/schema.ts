import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

/** Only same-origin paths may be used as a post-login destination. */
export function safeNextPath(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined
  return value
}

const trimmed = s.defaulted(s.string(), '').transform((value) => value.trim())

export const loginModes = ['signin', 'signup'] as const
export type LoginMode = (typeof loginModes)[number]

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

export function issueFor(issues: readonly FormIssue[] | undefined, name: string) {
  return issues?.find((issue) => {
    let first = issue.path?.[0]
    let key = typeof first === 'object' && first !== null ? first.key : first
    return key === name
  })
}

export function readText(formData: FormData | undefined, name: string): string {
  let value = formData?.get(name)
  return typeof value === 'string' ? value : ''
}
