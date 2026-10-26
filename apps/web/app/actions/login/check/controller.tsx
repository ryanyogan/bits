import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { CheckEmailPage } from './check-email-page.tsx'

export default createController(routes.login.check, {
  actions: {
    index(context) {
      let email = context.url.searchParams.get('email') ?? ''
      return context.render(<CheckEmailPage email={email} />)
    },
  },
})
