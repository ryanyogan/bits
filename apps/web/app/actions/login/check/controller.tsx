import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { pendingEmail } from '../pending-email.ts'
import { takePreviewCode } from '../preview-code.ts'
import { safeNextPath } from '../schema.ts'
import { CheckEmailPage } from './check-email-page.tsx'

export default createController(routes.login.check, {
  actions: {
    index(context) {
      let next = safeNextPath(context.url.searchParams.get('next'))
      // The address comes from the session POST /login wrote (decision 065).
      // Without one (another browser, an old link) there is nothing to check.
      let email = pendingEmail(context)
      if (!email) return redirect(routes.login.index.href(undefined, next ? { searchParams: { next } } : undefined), 303)
      return context.render(<CheckEmailPage email={email} previewCode={takePreviewCode(context, email)} next={next} />)
    },
  },
})
