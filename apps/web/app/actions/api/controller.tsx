import * as s from 'remix/data-schema'
import { createController } from 'remix/router'

import { rateLimit } from '../../middleware/rate-limit.tsx'
import { routes } from '../../routes.ts'
import { jsonError, startRun } from '../../runs/run.ts'
import { completeVideoUpload, startVideoUpload, uploadVideoPart } from '../../video/upload.ts'
import { authorUpload } from './author-upload.ts'
import { saveDraftsAction } from './drafts.ts'
import { runForm } from './schema.ts'

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
    passkey: (context) => notImplemented(`passkey/${context.params.step}`),
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
    authorVideoPart: (context) => uploadVideoPart(context),
    authorVideoComplete: (context) => completeVideoUpload(context),
  },
})
