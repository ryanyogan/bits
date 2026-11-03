import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { currentUser, recentlyAuthenticated } from '../../auth/identity.ts'
import { registrationOptions, relyingParty, signInOptions } from '../../auth/passkeys.ts'
import { rateLimit } from '../../middleware/rate-limit.tsx'
import { answerAsk } from '../../progress/answers.ts'
import { flashVerdict } from '../../progress/ask-session.ts'
import { routes } from '../../routes.ts'
import { fieldNames } from '../courses/lesson/ui/exercise.ts'
import { coachAttempt, revealReference } from '../../runs/coach.ts'
import { jsonError, startRun } from '../../runs/run.ts'
import { completeVideoUpload, startVideoUpload, uploadVideoPart } from '../../video/upload.ts'
import { authorUpload } from './author-upload.ts'
import { saveDraftsAction } from './drafts.ts'
import { askForm, coachForm, runForm } from './schema.ts'

function noStoreJson(body: unknown) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

function notImplemented(endpoint: string) {
  return jsonError('not_implemented', 501, { endpoint })
}

// JSON endpoints. The rest are 501 stubs until their milestone lands.
export default createController(routes.api, {
  actions: {
    // A learner's prompt: streamed text, live or canned (decision 019).
    run: {
      middleware: [rateLimit('RL_RUNS', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      handler(context) {
        let parsed = s.parseSafe(runForm, context.formData)
        if (!parsed.success) {
          return jsonError('invalid', 422, { issues: parsed.issues.map((issue) => issue.message) })
        }
        return startRun(context, parsed.value)
      },
    },
    // An answer to a quick check (decision 052): graded and journalled on
    // the server. The islands ask for JSON; a native form (no JS yet) gets
    // a 303 back to the lesson, which shows the flashed verdict.
    ask: {
      middleware: [rateLimit('RL_ASKS', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      async handler(context) {
        let parsed = s.parseSafe(askForm, context.formData)
        if (!parsed.success) {
          return jsonError('invalid', 422, { issues: parsed.issues.map((issue) => issue.message) })
        }
        let { course, lesson, ask } = parsed.value
        // A multiple-choice ask posts one value per ticked box without JS
        // (decision 067): "a" and "c" read as "a, c", as the island sends it.
        let answer = context.formData
          .getAll(fieldNames.ask(ask))
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
          .join(', ')
        let wantsJson = (context.headers.get('Accept') ?? '').includes('application/json')
        let back = () =>
          redirect(`${routes.courses.lesson.index.href({ course, lesson })}#ask-${ask}`, 303)
        if (!answer) return wantsJson ? jsonError('empty', 422) : back()
        let result = await answerAsk(context, { course, lesson, ask, answer })
        if (wantsJson) return result.ok ? noStoreJson(result.verdict) : jsonError(result.error, result.status)
        if (!result.ok) return back()
        flashVerdict(context, { course, lesson, ask, verdict: result.verdict })
        return back()
      },
    },
    // The coach (decision 064): grades a journalled run (cheapest layer
    // first, the judge only for a coached block), or reveals the strong
    // prompt after enough misses. JSON for the PromptComposer.
    coach: {
      middleware: [rateLimit('RL_COACH', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      async handler(context) {
        let parsed = s.parseSafe(coachForm, context.formData)
        if (!parsed.success) {
          return jsonError('invalid', 422, { issues: parsed.issues.map((issue) => issue.message) })
        }
        let { course, lesson, exercise, attempt, reveal } = parsed.value
        if (reveal) {
          let result = await revealReference(context, { course, lesson, exercise })
          return result.ok ? noStoreJson({ reference: result.reference }) : jsonError(result.error, result.status)
        }
        if (!attempt) return jsonError('invalid', 422, { issues: ['attempt is required'] })
        let result = await coachAttempt(context, { course, lesson, exercise, attempt })
        return result.ok ? noStoreJson(result.verdict) : jsonError(result.error, result.status)
      },
    },
    // WebAuthn options (decision 030). The browser's answer comes back as a
    // native form POST: /login/passkey or /settings/methods.
    passkey: {
      middleware: [rateLimit('RL_SIGNIN', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      async handler(context) {
        let rp = relyingParty(context.url, context.headers.get('Origin'))
        switch (context.params.step) {
          case 'login-options':
            return noStoreJson(await signInOptions(context.db, rp))
          case 'register-options': {
            let user = currentUser(context)
            if (!user) return jsonError('unauthorized', 401)
            if (!recentlyAuthenticated(context)) return jsonError('reauth_required', 403)
            let result = await registrationOptions(context.db, user, rp)
            return result.ok ? noStoreJson(result.options) : jsonError('too_many_passkeys', 409)
          }
          default:
            return jsonError('not_found', 404)
        }
      },
    },
    authorUpload: (context) => authorUpload(context),
    // A signed-in learner's drafts and watch position, sent in the background (decision 029).
    drafts: {
      middleware: [rateLimit('RL_DRAFTS', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      handler: (context) => saveDraftsAction(context),
    },
    // Lesson videos into R2, in parts through the Worker (decision 029).
    authorVideoStart: {
      middleware: [rateLimit('RL_WRITES', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      handler: (context) => startVideoUpload(context),
    },
    // A 1 GB video is ~100 parts, so parts get their own, roomier tier.
    authorVideoPart: {
      middleware: [rateLimit('RL_UPLOADS', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      handler: (context) => uploadVideoPart(context),
    },
    authorVideoComplete: {
      middleware: [rateLimit('RL_WRITES', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      handler: (context) => completeVideoUpload(context),
    },
  },
})
