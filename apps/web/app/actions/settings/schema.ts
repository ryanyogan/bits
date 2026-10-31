import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

const trimmed = s.defaulted(s.string(), '').transform((value) => value.trim())

/** POST /settings/profile */
export const profileForm = f.object({
  name: f.field(
    trimmed
      .refine((value) => value.length > 0, 'Enter a display name.')
      .pipe(checks.maxLength(60)),
  ),
  handle: f.field(
    trimmed
      .transform((value) => value.toLowerCase())
      .refine(
        (value) => /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/.test(value) && value.length >= 2,
        'Use 2–32 letters, numbers, dashes or underscores.',
      ),
  ),
  visibility: f.field(s.defaulted(s.enum_(['public', 'private'] as const), 'public')),
})

/** POST /settings/appearance: the theme (decision 062). */
export const appearanceForm = f.object({
  theme: f.field(s.enum_(['system', 'dark', 'light'] as const)),
})

/** POST /settings/email */
export const emailForm = f.object({
  email: f.field(
    s
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(checks.email(), checks.maxLength(254)),
  ),
})

/**
 * POST /settings/methods: `intent` is `add-passkey` (with the browser's
 * `response`), `rename:<credential id>` (with `name`), `remove:<credential id>`
 * or `disconnect:<provider>`. Credential ids are base64url.
 */
export const methodsForm = f.object({
  intent: f.field(
    s
      .string()
      .refine(
        (value) => /^((remove|rename):[\w-]{1,1400}|disconnect:(github|google)|add-passkey)$/.test(value),
        'Unknown action.',
      ),
  ),
})

/** `name` for `rename:<id>`: 1–60 characters once trimmed. */
export const passkeyNameForm = f.object({
  name: f.field(trimmed.refine((value) => value.length > 0, 'Enter a name.').pipe(checks.maxLength(60))),
})

/** POST /settings/email/confirm: the 6-digit code mailed to the new address. */
export const emailCodeForm = f.object({
  code: f.field(
    s
      .string()
      .transform((value) => value.replace(/\s+/g, ''))
      .refine((value) => /^\d{6}$/.test(value), 'Enter the 6-digit code from the email.'),
  ),
})

/** POST /settings/delete: the typed handle must match. */
export const deleteForm = f.object({
  confirm: f.field(trimmed.transform((value) => value.replace(/^@/, '').toLowerCase())),
})
