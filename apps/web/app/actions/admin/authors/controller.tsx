import { addCourseAuthor, demoteAuthor, readAuthorsOverview, removeCourseAuthor, revokeAuthorInvite, type User } from '@bits/db'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { inviteAuthor } from '../../../auth/author-invites.ts'
import { requireUser, toViewer } from '../../../auth/identity.ts'
import { requireAdmin } from '../../../auth/require-admin.tsx'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import type { AppContext } from '../../../router.ts'
import { routes } from '../../../routes.ts'
import { readText } from '../../login/schema.ts'
import { AdminAuthorsPage, type AdminErrors, type AdminNotice, type AdminSection } from './authors-page.tsx'
import { courseForm, inviteForm, revokeForm, roleForm } from './schema.ts'

const noStore = { 'Cache-Control': 'no-store' }

// /admin/authors (decision 037): admins invite authors, withdraw invites,
// step people down and manage who writes which course. requireAdmin checks
// the role from this request's users row on every action, and each write's
// SQL checks it again.
export default createController(routes.admin.authors, {
  middleware: [requireUser(), requireAdmin()],
  actions: {
    async index(context) {
      return page(context, { notice: noticeFor(context.url.searchParams) })
    },

    invite: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let admin = context.auth.identity
        let parsed = s.parseSafe(inviteForm, context.formData)
        let values = { email: readText(context.formData, 'email'), courses: context.formData.getAll('courses').map(String) }
        if (!parsed.success) {
          return invalid(context, { section: 'invite', message: 'Enter an email address like you@somewhere.dev.', field: 'email', values })
        }
        let result = await inviteAuthor(context.db, {
          admin,
          email: parsed.value.email,
          courses: [...new Set(parsed.value.courses)],
          origin: context.url.origin,
        })
        if (!result.ok) {
          // 4xx, never 5xx: the browser runtime treats a 5xx as a failed navigation (decision 020).
          let { message, status } = inviteFailures[result.reason]
          return invalid(context, { section: 'invite', message, values }, status)
        }
        return saved('invited')
      },
    },

    revoke: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let parsed = s.parseSafe(revokeForm, context.formData)
        let ok =
          parsed.success &&
          (await revokeAuthorInvite(context.db, { id: parsed.value.invite, adminId: context.auth.identity.id, now: Date.now() }))
        if (!ok) return invalid(context, { section: 'invites', message: 'That invite is no longer open.' })
        return saved('revoked')
      },
    },

    role: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let admin = context.auth.identity
        let parsed = s.parseSafe(roleForm, context.formData)
        if (!parsed.success) return invalid(context, { section: 'people', message: 'Pick someone to change.' })
        if (parsed.value.user === admin.id) {
          return invalid(context, { section: 'people', message: 'You can’t remove your own admin role. Ask another admin.' })
        }
        let ok = await demoteAuthor(context.db, { userId: parsed.value.user, from: parsed.value.from, adminId: admin.id, now: Date.now() })
        if (!ok) return invalid(context, { section: 'people', message: 'That person’s role has already changed.' })
        return saved(parsed.value.from === 'admin' ? 'admin-removed' : 'author-removed')
      },
    },

    course: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let adminId = context.auth.identity.id
        let parsed = s.parseSafe(courseForm, context.formData)
        if (!parsed.success) {
          return invalid(context, { section: 'courses', message: 'Pick an author for the course.', course: readText(context.formData, 'course') })
        }
        let { intent, course, user } = parsed.value
        let ok =
          intent === 'add'
            ? await addCourseAuthor(context.db, { slug: course, userId: user, adminId, now: Date.now() })
            : await removeCourseAuthor(context.db, { slug: course, userId: user, adminId })
        if (!ok) {
          let message = intent === 'add' ? 'They’re already on that course, or aren’t an author.' : 'They’re not on that course any more.'
          return invalid(context, { section: 'courses', message, course })
        }
        return saved(intent === 'add' ? 'course-added' : 'course-removed')
      },
    },
  },
})

const inviteFailures = {
  forbidden: { status: 403, message: 'Only admins can invite authors.' },
  'send-failed': { status: 422, message: 'We couldn’t send the invite just now. Try again in a few minutes.' },
  // The global daily mail cap (decision 039).
  'rate-global': { status: 429, message: 'We’ve sent all the email we can for today. Try the invite again tomorrow.' },
} as const

type AdminContext =Pick<AppContext, 'db' | 'render' | 'url'> & { auth: { identity: User } }

async function page(context: AdminContext, extra: { notice?: AdminNotice; errors?: AdminErrors }, status = 200) {
  let user = context.auth.identity
  let overview = await readAuthorsOverview(context.db, Date.now())
  return context.render(
    <AdminAuthorsPage
      viewer={toViewer(user)}
      timeZone={user.timezone || 'UTC'}
      overview={overview}
      currentPath={context.url.pathname}
      {...extra}
    />,
    { status, headers: noStore },
  )
}

function invalid(context: AdminContext, errors: AdminErrors, status = 422) {
  return page(context, { errors }, status)
}

const anchors: Record<string, AdminSection> = {
  invited: 'invites',
  revoked: 'invites',
  'admin-removed': 'people',
  'author-removed': 'people',
  'course-added': 'courses',
  'course-removed': 'courses',
}

function saved(what: string) {
  let href = routes.admin.authors.index.href(undefined, { searchParams: { saved: what } })
  return redirect(`${href}#${anchors[what] ?? 'invite'}`, 303)
}

function noticeFor(params: URLSearchParams): AdminNotice | undefined {
  switch (params.get('saved')) {
    case 'invited':
      return { tone: 'ok', text: 'Invite sent. It shows under open invites until it’s accepted or expires.' }
    case 'revoked':
      return { tone: 'ok', text: 'Invite withdrawn. Its link no longer works.' }
    case 'admin-removed':
      return { tone: 'ok', text: 'Admin role removed. They’re an author now.' }
    case 'author-removed':
      return { tone: 'ok', text: 'Author role removed, and they’re off every course.' }
    case 'course-added':
      return { tone: 'ok', text: 'Added to the course.' }
    case 'course-removed':
      return { tone: 'ok', text: 'Removed from the course.' }
    default:
      return undefined
  }
}
