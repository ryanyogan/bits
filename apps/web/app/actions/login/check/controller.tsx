import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { safeNextPath } from '../schema.ts'
import { CheckEmailPage } from './check-email-page.tsx'

export default createController(routes.login.check, {
  actions: {
    index(context) {
      let params = context.url.searchParams
      return context.render(
        <CheckEmailPage
          email={params.get('email') ?? ''}
          mode={params.get('mode') === 'signup' ? 'signup' : 'signin'}
          next={safeNextPath(params.get('next'))}
        />,
      )
    },
  },
})
