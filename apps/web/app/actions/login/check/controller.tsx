import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { takePreviewCode } from '../preview-code.ts'
import { safeNextPath } from '../schema.ts'
import { CheckEmailPage } from './check-email-page.tsx'

export default createController(routes.login.check, {
  actions: {
    index(context) {
      let params = context.url.searchParams
      let email = params.get('email') ?? ''
      return context.render(
        <CheckEmailPage
          email={email}
          previewCode={email ? takePreviewCode(context, email) : undefined}
          mode={params.get('mode') === 'signup' ? 'signup' : 'signin'}
          next={safeNextPath(params.get('next'))}
        />,
      )
    },
  },
})
