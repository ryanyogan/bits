import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'

function notImplemented(what: string) {
  return Response.json({ error: 'not_implemented', what }, { status: 501 })
}

// Stubs for GitHub/Google OAuth (remix/auth). Land with the auth milestone.
export default createController(routes.auth.oauth, {
  actions: {
    start(context) {
      return notImplemented(`oauth start: ${context.params.provider}`)
    },
    callback(context) {
      return notImplemented(`oauth callback: ${context.params.provider}`)
    },
  },
})
