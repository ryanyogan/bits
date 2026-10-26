import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

// Stub: there are no sessions yet, so signing out just goes home.
export default createController(routes.logout, {
  actions: {
    action() {
      return redirect(routes.home.href(), 303)
    },
  },
})
