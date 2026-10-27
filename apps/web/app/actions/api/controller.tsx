import * as s from 'remix/data-schema'
import { createController } from 'remix/router'

import { currentUser } from '../../auth/identity.ts'
import { registrationOptions, relyingParty, signInOptions } from '../../auth/passkeys.ts'
import { rateLimit } from '../../middleware/rate-limit.tsx'
import { routes } from '../../routes.ts'
import { jsonError, startRun } from '../../runs/run.ts'
import { authorUpload } from './author-upload.ts'
import { runForm } from './schema.ts'

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
    // WebAuthn options (decision 030). The browser's answer comes back as a
    // native form POST: /login/passkey or /settings/methods.
    passkey: {
      middleware: [rateLimit('RL_SIGNIN', () => jsonError('rate_limited', 429, { retryAfter: 60 }))],
      async handler(context) {
        let rp = relyingParty(context.url)
        switch (context.params.step) {
          case 'login-options':
            return noStoreJson(await signInOptions(context.db, rp))
          case 'register-options': {
            let user = currentUser(context)
            if (!user) return jsonError('unauthorized', 401)
            let result = await registrationOptions(context.db, user, rp)
            return result.ok ? noStoreJson(result.options) : jsonError('too_many_passkeys', 409)
          }
          default:
            return jsonError('not_found', 404)
        }
      },
    },
    authorUpload: (context) => authorUpload(context),
    authorVideoUploadUrl: () => notImplemented('author/video-upload-url'),
  },
})
