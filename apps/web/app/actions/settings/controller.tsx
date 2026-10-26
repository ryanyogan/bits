import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { getViewer, type Viewer } from '../../data/fixtures.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { issueField, readText, type FormIssue } from '../login/schema.ts'
import { getAccountSettings, takenHandles } from './data.ts'
import { deleteForm, emailForm, methodsForm, profileForm } from './schema.ts'
import { SettingsPage, type SettingsErrors, type SettingsNotice, type SettingsSection } from './settings-page.tsx'

// Stubs: every action validates its form and redirects back with ?saved=,
// writing nothing. Sessions, D1 writes and WebAuthn land with the auth milestone.
export default createController(routes.settings, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      return context.render(
        <SettingsPage
          viewer={viewer}
          account={getAccountSettings(viewer)}
          notice={noticeFor(context.url.searchParams)}
        />,
      )
    },

    export(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      let account = getAccountSettings(viewer)
      let body = {
        format: 'bits-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        note: 'Sample export: real progress, badges and prompts arrive with the data milestone.',
        account: { name: viewer.name, handle: viewer.handle, email: viewer.email, public: viewer.isPublic },
        signInMethods: account.methods.filter((m) => m.connected).map(({ kind, meta }) => ({ kind, meta })),
        progress: { neurons: viewer.xp, streak: viewer.streak, bestStreak: viewer.bestStreak },
        badges: [],
        prompts: [],
      }
      return new Response(JSON.stringify(body, null, 2) + '\n', {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="bits-${viewer.handle}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    },

    profile(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      let parsed = s.parseSafe(profileForm, context.formData)
      let fields: SettingsErrors['fields'] = {}
      if (!parsed.success) {
        for (let issue of parsed.issues) {
          let key = fieldOf(issue)
          if (key && !fields[key]) fields[key] = issue.message
        }
      } else if (parsed.value.handle !== viewer.handle && takenHandles.includes(parsed.value.handle)) {
        fields.handle = 'That handle is taken.'
      }
      if (Object.keys(fields).length) {
        return invalid(context, viewer, 'profile', fields, ['name', 'handle', 'visibility'])
      }
      return saved('profile')
    },

    email(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      let parsed = s.parseSafe(emailForm, context.formData)
      if (!parsed.success) {
        return invalid(context, viewer, 'email', { email: 'Enter an email address like you@somewhere.dev.' }, ['email'])
      }
      if (parsed.value.email === viewer.email) {
        return invalid(context, viewer, 'email', { email: 'That is already your email.' }, ['email'])
      }
      return saved('email', { email: parsed.value.email })
    },

    methods(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      let parsed = s.parseSafe(methodsForm, context.formData)
      if (!parsed.success) return saved('methods-error')
      let { intent } = parsed.value
      if (intent === 'add-passkey') return saved('passkey-needs-js')
      return saved(intent.startsWith('disconnect:') ? 'disconnected' : 'removed', {
        method: intent.split(':')[1]!,
      })
    },

    sessions(context) {
      if (!getViewer(context.url)) return toLogin()
      return saved('sessions')
    },

    deleteAccount(context) {
      let viewer = getViewer(context.url)
      if (!viewer) return toLogin()
      let parsed = s.parseSafe(deleteForm, context.formData)
      if (!parsed.success || parsed.value.confirm !== viewer.handle.toLowerCase()) {
        return invalid(context, viewer, 'danger', { confirm: `Type ${viewer.handle} exactly to confirm.` }, ['confirm'])
      }
      return saved('deleted')
    },
  },
})

function invalid(
  context: AppContext,
  viewer: Viewer,
  section: SettingsSection,
  fields: SettingsErrors['fields'],
  names: string[],
) {
  let values = Object.fromEntries(names.map((name) => [name, readText(context.formData, name)]))
  return context.render(
    <SettingsPage
      viewer={viewer}
      account={getAccountSettings(viewer)}
      errors={{ section, fields, values }}
    />,
    { status: 422 },
  )
}

function fieldOf(issue: FormIssue): string | undefined {
  let key = issueField(issue)
  return typeof key === 'string' ? key : undefined
}

function toLogin() {
  return redirect(routes.login.index.href(undefined, { searchParams: { next: routes.settings.index.href() } }), 303)
}

const anchors: Record<string, SettingsSection> = {
  profile: 'profile',
  email: 'email',
  removed: 'sign-in',
  disconnected: 'sign-in',
  'passkey-needs-js': 'sign-in',
  'methods-error': 'sign-in',
  sessions: 'sessions',
  deleted: 'danger',
}

function saved(what: string, extra: Record<string, string> = {}) {
  let href = routes.settings.index.href(undefined, { searchParams: { saved: what, ...extra } })
  return redirect(`${href}#${anchors[what] ?? 'profile'}`, 303)
}

const providerNames: Record<string, string> = { github: 'GitHub', google: 'Google' }

/** The success (or follow-up) Callout for `?saved=` after a PRG redirect. */
export function noticeFor(params: URLSearchParams): SettingsNotice | undefined {
  switch (params.get('saved')) {
    case 'profile':
      return { section: 'profile', tone: 'ok', text: 'Saved. Your profile is up to date.' }
    case 'email': {
      let email = params.get('email')
      return {
        section: 'email',
        tone: 'ok',
        text: email ? `Check ${email} for a link to confirm the change.` : 'Check your new inbox for a link to confirm the change.',
      }
    }
    case 'removed':
      return { section: 'sign-in', tone: 'ok', text: 'Passkey removed.' }
    case 'disconnected': {
      let name = providerNames[params.get('method') ?? ''] ?? 'Provider'
      return { section: 'sign-in', tone: 'ok', text: `${name} disconnected.` }
    }
    case 'passkey-needs-js':
      return { section: 'sign-in', tone: 'warning', text: 'Adding a passkey needs JavaScript. Turn it on and try again.' }
    case 'methods-error':
      return { section: 'sign-in', tone: 'warning', text: 'That didn’t work. Try again.' }
    case 'sessions':
      return { section: 'sessions', tone: 'ok', text: 'Signed out everywhere.' }
    case 'deleted':
      return { section: 'danger', tone: 'ok', text: 'Deletion requested. (Preview build: nothing was deleted.)' }
    default:
      return undefined
  }
}
