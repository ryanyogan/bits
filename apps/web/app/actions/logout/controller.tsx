import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { rateLimit } from '../../middleware/rate-limit.tsx'
import { routes } from '../../routes.ts'

// POST only (cross-origin POSTs are stopped by cop() in the router). Destroying
// the session deletes its D1 row and clears the cookie. Burst-limited like
// every write (decision 065): each sign-out is a D1 delete.
export default createController(routes.logout, {
  actions: {
    action: {
      middleware: [rateLimit('RL_LOGOUT')],
      handler(context) {
        context.session.destroy()
        return redirect(routes.home.href(), 303)
      },
    },
  },
})
