import * as s from 'remix/data-schema'
import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'
import { CheckEmailPage } from '../../login/check/check-email-page.tsx'
import { readText, verifyCodeForm } from '../../login/schema.ts'

// Stubs. Token/code verification and session creation land with the auth
// milestone; until then a valid submission answers 501 Not Implemented.
export default createController(routes.auth.verify, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title="Verifying…"
          pattern="/auth/verify?token="
          summary="Magic-link landing. Will verify the token, create a session and redirect to ?next. Not implemented yet."
        />,
        { status: 501 },
      )
    },

    action(context) {
      let parsed = s.parseSafe(verifyCodeForm, context.formData)
      if (!parsed.success) {
        return context.render(
          <CheckEmailPage
            email={readText(context.formData, 'email')}
            code={readText(context.formData, 'code')}
            issues={parsed.issues}
          />,
          { status: 422 },
        )
      }

      return context.render(
        <PlaceholderPage
          title="Almost there"
          pattern="POST /auth/verify"
          summary="The code looks right, but sign-in isn’t wired up yet. Nothing was saved."
        />,
        { status: 501 },
      )
    },
  },
})
