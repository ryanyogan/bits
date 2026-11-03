import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

// Third-party callbacks. None is wired up yet (decision 068): GitHub sync
// isn't built, so the endpoint answers like any unknown path. A 404, never a
// 5xx: logServerErrors() logs every 5xx at `error`, which opens a Workers
// Issue (decision 039), and a stray delivery isn't something to look at.
// Signature verification lands with each integration.
export default createController(routes.webhooks, {
  actions: {
    github: () => Response.json({ error: 'not_found' }, { status: 404 }),
  },
})
