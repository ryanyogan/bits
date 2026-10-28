import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

const idPattern = /^[\w-]{1,64}$/
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/

const id = (message: string) => s.string().refine((value) => idPattern.test(value), message)
const slug = s.string().refine((value) => slugPattern.test(value), 'Pick a course.')

/** POST /admin/authors/invite: the address, and any courses to join on accept. */
export const inviteForm = f.object({
  email: f.field(
    s
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(checks.email(), checks.maxLength(254)),
  ),
  courses: f.fields(s.array(slug)),
})

/** POST /admin/authors/revoke */
export const revokeForm = f.object({
  invite: f.field(id('Unknown invite.')),
})

/** POST /admin/authors/role: step `user` down from `from` (admin → author, author → learner). */
export const roleForm = f.object({
  user: f.field(id('Unknown person.')),
  from: f.field(s.enum_(['admin', 'author'] as const)),
})

/** POST /admin/authors/course: add or remove `user` on `course`. */
export const courseForm = f.object({
  intent: f.field(s.enum_(['add', 'remove'] as const)),
  course: f.field(slug),
  user: f.field(id('Pick an author.')),
})
