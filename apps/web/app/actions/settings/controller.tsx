import {
  deleteUserSessions,
  findUserByHandle,
  listAttempts,
  listCompletedLessons,
  listUserBadges,
  reservedHandles,
  unlinkIdentity,
  users,
  type User,
} from '@bits/db'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { requireUser, toViewer } from '../../auth/identity.ts'
import { currentStreak } from '../../progress/days.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { issueField, readText, type FormIssue } from '../login/schema.ts'
import { getAccountSettings } from './data.ts'
import { deleteForm, emailForm, methodsForm, profileForm } from './schema.ts'
import { SettingsPage, type SettingsErrors, type SettingsNotice, type SettingsSection } from './settings-page.tsx'

// Signed-in only (requireUser sends everyone else to /login?next=). Each form
// posts to its own action and redirects back with ?saved= (PRG).
export default createController(routes.settings, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let user = context.auth.identity
      return context.render(
        <SettingsPage
          viewer={toViewer(user)}
          account={await getAccountSettings(context.db, user, context.session.id)}
          notice={noticeFor(context.url.searchParams)}
        />,
      )
    },

    async export(context) {
      let user = context.auth.identity
      let [account, lessons, attempts, badges] = await Promise.all([
        getAccountSettings(context.db, user, context.session.id),
        listCompletedLessons(context.db, user.id),
        listAttempts(context.db, user.id, 10_000),
        listUserBadges(context.db, user.id),
      ])
      let body = {
        format: 'bits-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        account: {
          name: user.display_name,
          handle: user.handle,
          email: user.email,
          public: user.is_public,
          goals: user.goals,
          timezone: user.timezone,
          createdAt: new Date(user.created_at).toISOString(),
        },
        signInMethods: account.methods.filter((m) => m.connected).map(({ kind, meta }) => ({ kind, meta })),
        progress: {
          neurons: user.xp_total,
          streak: { current: currentStreak(user), best: user.best_streak },
          lessons: lessons.map((row) => ({
            course: row.course_id,
            lesson: row.lesson_slug,
            completedAt: new Date(row.completed_at).toISOString(),
          })),
        },
        badges: badges.map((row) => ({ id: row.badge_id, awardedAt: new Date(row.awarded_at).toISOString() })),
        prompts: attempts.map((row) => ({
          course: row.course_id,
          lesson: row.lesson_slug,
          exercise: row.exercise_id,
          prompt: row.prompt,
          passed: row.passed,
          temperatures: row.temperatures,
          at: new Date(row.created_at).toISOString(),
        })),
      }
      return new Response(JSON.stringify(body, null, 2) + '\n', {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="bits-${user.handle}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    },

    async profile(context) {
      let user = context.auth.identity
      let parsed = s.parseSafe(profileForm, context.formData)
      let fields: SettingsErrors['fields'] = {}
      if (!parsed.success) {
        for (let issue of parsed.issues) {
          let key = fieldOf(issue)
          if (key && !fields[key]) fields[key] = issue.message
        }
      } else if (parsed.value.handle !== user.handle && (await handleTaken(context, parsed.value.handle, user))) {
        fields.handle = 'That handle is taken.'
      }
      if (!parsed.success || Object.keys(fields).length) {
        return invalid(context, user, 'profile', fields, ['name', 'handle', 'visibility'])
      }
      let { name, handle, visibility } = parsed.value
      try {
        await context.db.update(users, user.id, { display_name: name, handle, is_public: visibility === 'public' })
      } catch {
        // Lost a race for the handle (unique index).
        return invalid(context, user, 'profile', { handle: 'That handle is taken.' }, ['name', 'handle', 'visibility'])
      }
      return saved('profile')
    },

    // Changing the sign-in email needs its own confirm-the-new-address flow,
    // which is not built yet: validate, then say so instead of pretending.
    email(context) {
      let user = context.auth.identity
      let parsed = s.parseSafe(emailForm, context.formData)
      if (!parsed.success) {
        return invalid(context, user, 'email', { email: 'Enter an email address like you@somewhere.dev.' }, ['email'])
      }
      if (parsed.value.email === user.email) {
        return invalid(context, user, 'email', { email: 'That is already your email.' }, ['email'])
      }
      return saved('email-unavailable')
    },

    async methods(context) {
      let user = context.auth.identity
      let parsed = s.parseSafe(methodsForm, context.formData)
      if (!parsed.success) return saved('methods-error')
      let { intent } = parsed.value
      if (intent === 'add-passkey') return saved('passkey-needs-js')
      if (intent === 'disconnect:github' || intent === 'disconnect:google') {
        let provider = intent === 'disconnect:github' ? ('github' as const) : ('google' as const)
        // Email sign-in always works, so removing a provider never locks anyone out.
        await unlinkIdentity(context.db, user.id, provider)
        return saved('disconnected', { method: provider })
      }
      // remove:<passkey id>: there are no passkeys until the passkey milestone.
      return saved('methods-error')
    },

    async sessions(context) {
      await deleteUserSessions(context.db, context.auth.identity.id)
      context.session.destroy()
      return redirect(routes.login.index.href(undefined, { searchParams: { notice: 'signed-out-everywhere' } }), 303)
    },

    async deleteAccount(context) {
      let user = context.auth.identity
      let parsed = s.parseSafe(deleteForm, context.formData)
      if (!parsed.success || parsed.value.confirm !== user.handle.toLowerCase()) {
        return invalid(context, user, 'danger', { confirm: `Type ${user.handle} exactly to confirm.` }, ['confirm'])
      }
      // Identities, passkeys and sessions cascade from the user row (decision 008).
      await context.db.delete(users, user.id)
      context.session.destroy()
      return redirect(routes.home.href(), 303)
    },
  },
})

type SettingsContext = Pick<AppContext, 'db' | 'render' | 'formData' | 'session'>

async function invalid(
  context: SettingsContext,
  user: User,
  section: SettingsSection,
  fields: SettingsErrors['fields'],
  names: string[],
) {
  let values = Object.fromEntries(names.map((name) => [name, readText(context.formData, name)]))
  return context.render(
    <SettingsPage
      viewer={toViewer(user)}
      account={await getAccountSettings(context.db, user, context.session.id)}
      errors={{ section, fields, values }}
    />,
    { status: 422 },
  )
}

async function handleTaken(context: SettingsContext, handle: string, user: User): Promise<boolean> {
  if (reservedHandles.has(handle)) return true
  let owner = await findUserByHandle(context.db, handle)
  return owner != null && owner.id !== user.id
}

function fieldOf(issue: FormIssue): string | undefined {
  let key = issueField(issue)
  return typeof key === 'string' ? key : undefined
}

const anchors: Record<string, SettingsSection> = {
  profile: 'profile',
  'email-unavailable': 'email',
  removed: 'sign-in',
  disconnected: 'sign-in',
  connected: 'sign-in',
  'already-linked': 'sign-in',
  'passkey-needs-js': 'sign-in',
  'methods-error': 'sign-in',
}

function saved(what: string, extra: Record<string, string> = {}) {
  let href = routes.settings.index.href(undefined, { searchParams: { saved: what, ...extra } })
  return redirect(`${href}#${anchors[what] ?? 'profile'}`, 303)
}

const providerNames: Record<string, string> = { github: 'GitHub', google: 'Google' }

/** The success (or follow-up) Callout for `?saved=` after a PRG redirect. */
export function noticeFor(params: URLSearchParams): SettingsNotice | undefined {
  let provider = providerNames[params.get('method') ?? ''] ?? 'Provider'
  switch (params.get('saved')) {
    case 'profile':
      return { section: 'profile', tone: 'ok', text: 'Saved. Your profile is up to date.' }
    case 'email-unavailable':
      return {
        section: 'email',
        tone: 'warning',
        text: 'Changing your email isn’t available yet. Your sign-in email hasn’t changed.',
      }
    case 'removed':
      return { section: 'sign-in', tone: 'ok', text: 'Passkey removed.' }
    case 'disconnected':
      return { section: 'sign-in', tone: 'ok', text: `${provider} disconnected.` }
    case 'connected':
      return { section: 'sign-in', tone: 'ok', text: `${provider} connected. You can sign in with it now.` }
    case 'already-linked':
      return {
        section: 'sign-in',
        tone: 'warning',
        text: `That ${provider} account is already connected to a different Bits account.`,
      }
    case 'passkey-needs-js':
      return { section: 'sign-in', tone: 'warning', text: 'Adding a passkey needs JavaScript. Turn it on and try again.' }
    case 'methods-error':
      return { section: 'sign-in', tone: 'warning', text: 'That didn’t work. Try again.' }
    default:
      return undefined
  }
}
