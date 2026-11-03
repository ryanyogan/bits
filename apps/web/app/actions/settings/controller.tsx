import {
  deletePasskey,
  deleteUserAndInvites,
  deleteUserSessions,
  findUserByHandle,
  listAskAttempts,
  listAttempts,
  listCoachVerdicts,
  listCompletedLessons,
  listUserBadges,
  renamePasskey,
  reservedHandles,
  unlinkIdentity,
  users,
  type User,
} from '@bits/db'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  cancelEmailChange,
  confirmEmailChangeCode,
  requestEmailChange,
} from '../../auth/email-change.ts'
import { requestEmailSignIn } from '../../auth/email-sign-in.ts'
import { recentlyAuthenticated, requireUser, signedInRecently, toViewer } from '../../auth/identity.ts'
import { registerPasskey, relyingParty } from '../../auth/passkeys.ts'
import { rateLimit } from '../../middleware/rate-limit.tsx'
import { currentStreak } from '../../progress/days.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { emailFailures } from '../login/controller.tsx'
import { issueField, readText, type FormIssue } from '../login/schema.ts'
import { deviceLabel, getAccountSettings } from './data.ts'
import { rememberTheme } from '../../progress/theme.ts'
import { settingsRedirect, takeSettingsNotice, type SettingsNotice, type SettingsSection } from './notice.ts'
import { appearanceForm, deleteForm, emailCodeForm, emailForm, methodsForm, passkeyNameForm, profileForm } from './schema.ts'
import { SettingsPage, type SettingsErrors } from './settings-page.tsx'

// Signed-in only (requireUser sends everyone else to /login?next=). Each form
// posts to its own action. A bad form re-renders 422 with its issues; a good
// one redirects 303 to its section, the outcome in the session flash (PRG,
// decision 068).
export default createController(routes.settings, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let user = context.auth.identity
      return context.render(
        <SettingsPage
          viewer={toViewer(user)}
          account={await getAccountSettings(context.db, user, context.session.id)}
          recentAuth={recentlyAuthenticated(context)}
          notice={takeSettingsNotice(context.session)}
          host={context.url.host}
        />,
      )
    },

    async export(context) {
      let user = context.auth.identity
      let [account, lessons, attempts, badges, answers, verdicts] = await Promise.all([
        getAccountSettings(context.db, user, context.session.id),
        listCompletedLessons(context.db, user.id),
        listAttempts(context.db, user.id, 10_000),
        listUserBadges(context.db, user.id),
        listAskAttempts(context.db, user.id, 10_000),
        listCoachVerdicts(context.db, user.id, 10_000),
      ])
      let body = {
        format: 'bits-export',
        version: 2,
        exportedAt: new Date().toISOString(),
        account: {
          name: user.display_name,
          handle: user.handle,
          email: user.email,
          public: user.is_public,
          goals: user.goals,
          timezone: user.timezone,
          // The reading depth picked on a lesson (decision 053); null until one is picked.
          lessonDepth: user.lesson_depth ?? null,
          // The theme (decision 062): system, dark or light.
          theme: user.theme ?? 'system',
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
          // submit (Complete lesson) or a run: live, example or fallback.
          source: row.source,
          ...(row.source === 'submit'
            ? { passed: row.passed }
            : {
                temperature: (row.temperature ?? 0) / 100,
                output: row.output,
                model: row.model,
                tokens: { input: row.input_tokens, output: row.output_tokens },
              }),
          at: new Date(row.created_at).toISOString(),
        })),
        // Quick-check answers, graded on the server (decision 052).
        answers: answers.map((row) => ({
          course: row.course_id,
          lesson: row.lesson_slug,
          ask: row.ask_id,
          answer: row.answer,
          correct: row.correct,
          at: new Date(row.created_at).toISOString(),
        })),
        // The coach's verdicts on prompt runs (decision 064): the layer that
        // decided, each criterion and the hint. A reveal row has no run.
        coach: verdicts.map((row) => ({
          course: row.course_id,
          lesson: row.lesson_slug,
          exercise: row.exercise_id,
          run: row.attempt_id,
          layer: row.layer,
          passed: row.passed,
          criteria: row.criteria,
          hint: row.hint,
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

    profile: {
      middleware: [rateLimit('RL_ACCOUNT')],
      async handler(context) {
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
      return saved(context, 'profile')
      },
    },

    // The theme (decision 062): system, dark or light, into users.theme.
    appearance: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let parsed = s.parseSafe(appearanceForm, context.formData)
        if (!parsed.success) {
          return invalid(context, context.auth.identity, 'appearance', {}, [], 422, {
            section: 'appearance',
            tone: 'warning',
            text: 'Pick System, Dark or Light.',
          })
        }
        await rememberTheme(context, parsed.value.theme)
        return saved(context, 'appearance')
      },
    },

    // Change the sign-in email (decision 030): mail a code + link to the new
    // address; nothing changes until it comes back. `intent=cancel` withdraws
    // an open change.
    email: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let user = context.auth.identity
        if (readText(context.formData, 'intent') === 'cancel') {
          await cancelEmailChange(context.db, user.id)
          return saved(context, 'email-cancelled')
        }
        // Moving the account's email is a takeover if the session is stolen
        // or left open: only a fresh sign-in may ask (decision 030).
        if (!recentlyAuthenticated(context)) return saved(context, 'reauth')
        let parsed = s.parseSafe(emailForm, context.formData)
        if (!parsed.success) {
          return invalid(context, user, 'email', { email: 'Enter an email address like you@somewhere.dev.' }, ['email'])
        }
        if (parsed.value.email === user.email.toLowerCase()) {
          return invalid(context, user, 'email', { email: 'That is already your email.' }, ['email'])
        }
        let result = await requestEmailChange(context.db, {
          user,
          email: parsed.value.email,
          ip: context.headers.get('CF-Connecting-IP'),
          origin: context.url.origin,
        })
        if (!result.ok && result.reason === 'revert-window') {
          let date = new Date(result.until).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: user.timezone || 'UTC',
          })
          let text = `An email change is waiting for confirmation from your previous address. Try again after ${date}.`
          return invalid(context, user, 'email', { email: text }, ['email'], 409)
        }
        if (!result.ok) {
          let failure = emailFailures[result.reason]
          return invalid(context, user, 'email', { email: failure.text }, ['email'], failure.status)
        }
        return saved(context, 'email-sent')
      },
    },

    // The 6-digit code from the new address.
    emailConfirm: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let user = context.auth.identity
        let parsed = s.parseSafe(emailCodeForm, context.formData)
        if (!parsed.success) {
          return invalid(context, user, 'email', { code: 'Enter the 6-digit code from the email.' }, ['code'])
        }
        let result = await confirmEmailChangeCode(context.db, {
          user,
          code: parsed.value.code,
          origin: context.url.origin,
          sessionId: context.session.id,
        })
        if (!result.ok) {
          let text = {
            wrong: 'That code isn’t right. Check the newest email and try again.',
            expired: 'That code has expired or had too many tries. Ask for a new one.',
            taken: 'That address already has a Bits account, so it can’t be yours too.',
          }[result.reason]
          return invalid(context, user, 'email', { code: text }, ['code'])
        }
        return saved(context, 'email-changed')
      },
    },

    // Sign-in methods: add a passkey (the AddPasskey island submits the
    // browser's answer as `response`), rename or remove one, or disconnect a
    // provider. Email sign-in always works, so nothing here can lock anyone out.
    methods: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let user = context.auth.identity
        let parsed = s.parseSafe(methodsForm, context.formData)
        if (!parsed.success) return invalid(context, user, 'sign-in', {}, [], 422, methodsError)
        let { intent } = parsed.value

        if (intent === 'add-passkey') {
          let response = readText(context.formData, 'response')
          // Without JS the button still submits, with no response.
          if (!response) return saved(context, 'passkey-needs-js')
          if (!recentlyAuthenticated(context)) return saved(context, 'reauth')
          let result = await registerPasskey(context.db, {
            user,
            rp: relyingParty(context.url, context.headers.get('Origin')),
            response,
            name: deviceLabel(context.headers.get('User-Agent')),
          })
          if (result.ok) return saved(context, 'passkey-added')
          return saved(context, result.reason === 'duplicate' ? 'passkey-duplicate' : result.reason === 'too-many' ? 'passkey-limit' : 'passkey-failed')
        }

        if (intent === 'disconnect:github' || intent === 'disconnect:google') {
          let provider = intent === 'disconnect:github' ? ('github' as const) : ('google' as const)
          await unlinkIdentity(context.db, user.id, provider)
          return saved(context, 'disconnected', { method: provider })
        }

        if (intent.startsWith('rename:')) {
          let name = s.parseSafe(passkeyNameForm, context.formData)
          if (!name.success) {
            return invalid(context, user, 'sign-in', {}, [], 422, {
              section: 'sign-in',
              tone: 'warning',
              text: 'Give the passkey a name of up to 60 characters.',
            })
          }
          let renamed = await renamePasskey(context.db, user.id, intent.slice('rename:'.length), name.value.name)
          return renamed ? saved(context, 'renamed') : invalid(context, user, 'sign-in', {}, [], 422, methodsError)
        }

        // remove:<credential id>; only the owner's rows match.
        let removed = await deletePasskey(context.db, user.id, intent.slice('remove:'.length))
        return removed ? saved(context, 'removed') : invalid(context, user, 'sign-in', {}, [], 422, methodsError)
      },
    },

    // Step-up before an email change or a new passkey: a sign-in code to the
    // CURRENT address, back to Settings. (The Settings page also offers a
    // passkey, through /login/passkey.) Signing in again refreshes `at`.
    reauth: {
      middleware: [rateLimit('RL_SIGNIN')],
      async handler(context) {
        let user = context.auth.identity
        let next = routes.settings.index.href()
        let result = await requestEmailSignIn(context.db, {
          email: user.email,
          signup: null,
          next,
          ip: context.headers.get('CF-Connecting-IP'),
          origin: context.url.origin,
        })
        if (!result.ok) return saved(context, 'reauth-failed')
        return redirect(routes.login.check.index.href(undefined, { searchParams: { email: user.email, next } }), 303)
      },
    },

    sessions: {
      middleware: [rateLimit('RL_ACCOUNT')],
      async handler(context) {
        await deleteUserSessions(context.db, context.auth.identity.id)
        context.session.destroy()
        return redirect(routes.login.index.href(undefined, { searchParams: { notice: 'signed-out-everywhere' } }), 303)
      },
    },

    deleteAccount: {
      middleware: [rateLimit('RL_ACCOUNT')],
      async handler(context) {
      let user = context.auth.identity
      let parsed = s.parseSafe(deleteForm, context.formData)
      if (!parsed.success || parsed.value.confirm !== user.handle.toLowerCase()) {
        return invalid(context, user, 'danger', { confirm: `Type ${user.handle} exactly to confirm.` }, ['confirm'])
      }
      // Identities, passkeys and sessions cascade from the user row (decision
      // 008); author invites to the address go with it (decision 037).
      await deleteUserAndInvites(context.db, user.id, user.email)
      context.session.destroy()
      return redirect(routes.home.href(), 303)
      },
    },
  },
})

type SettingsContext = Pick<AppContext, 'db' | 'render' | 'formData' | 'session' | 'url'>

async function invalid(
  context: SettingsContext,
  user: User,
  section: SettingsSection,
  fields: SettingsErrors['fields'],
  names: string[],
  status = 422,
  notice?: SettingsNotice,
) {
  let values = Object.fromEntries(names.map((name) => [name, readText(context.formData, name)]))
  return context.render(
    <SettingsPage
      viewer={toViewer(user)}
      account={await getAccountSettings(context.db, user, context.session.id)}
      recentAuth={signedInRecently(context.session)}
      errors={{ section, fields, values }}
      notice={notice}
      host={context.url.host}
    />,
    { status },
  )
}

const methodsError: SettingsNotice = { section: 'sign-in', tone: 'warning', text: 'That didn’t work. Try again.' }

/** 303 back to the section, the outcome flashed (decision 068). */
function saved(context: Pick<AppContext, 'session'>, what: string, extra: { method?: string } = {}) {
  return settingsRedirect(context.session, what, extra)
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

