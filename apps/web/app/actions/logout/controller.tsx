import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

// POST only (cross-origin POSTs are stopped by cop() in the router). Destroying
// the session deletes its D1 row and clears the cookie.
export default createController(routes.logout, {
  actions: {
    action(context) {
      context.session.destroy()
      return redirect(routes.home.href(), 303)
    },
  },
})
