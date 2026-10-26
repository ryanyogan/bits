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
        (value) => /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(value) && value.length >= 2,
        'Use 2–30 letters, numbers and dashes.',
      ),
  ),
  visibility: f.field(s.defaulted(s.enum_(['public', 'private'] as const), 'public')),
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

/** POST /settings/methods: `intent` is `remove:<id>`, `disconnect:<provider>` or `add-passkey`. */
export const methodsForm = f.object({
  intent: f.field(
    s.string().refine((value) => /^(remove:[\w-]+|disconnect:(github|google)|add-passkey)$/.test(value), 'Unknown action.'),
  ),
})

/** POST /settings/delete: the typed handle must match. */
export const deleteForm = f.object({
  confirm: f.field(trimmed.transform((value) => value.replace(/^@/, '').toLowerCase())),
})
