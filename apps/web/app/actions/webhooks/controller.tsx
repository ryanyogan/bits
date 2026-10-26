import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

function notImplemented(source: string) {
  return Response.json({ error: 'not_implemented', webhook: source }, { status: 501 })
}

// Third-party callbacks. Signature verification lands with each integration.
export default createController(routes.webhooks, {
  actions: {
    github: () => notImplemented('github'),
    video: () => notImplemented('video'),
  },
})
