import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { LoginPage } from './login-page.tsx'
import { loginForm, readText, safeNextPath, type LoginMode } from './schema.ts'

export default createController(routes.login, {
  actions: {
    index(context) {
      let mode: LoginMode = context.url.searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
      let next = safeNextPath(context.url.searchParams.get('next'))
      return context.render(<LoginPage mode={mode} next={next} />)
    },

    // Stub: validates the form and moves on. Issuing the email token, sending
    // the email and creating the user land with the auth milestone.
    action(context) {
      let parsed = s.parseSafe(loginForm, context.formData)
      if (!parsed.success) {
        let mode: LoginMode = readText(context.formData, 'mode') === 'signup' ? 'signup' : 'signin'
        return context.render(
          <LoginPage
            mode={mode}
            next={safeNextPath(readText(context.formData, 'next'))}
            values={{
              email: readText(context.formData, 'email'),
              displayName: readText(context.formData, 'displayName'),
            }}
            issues={parsed.issues}
          />,
          { status: 422 },
        )
      }

      let { email, next } = parsed.value
      return redirect(
        routes.login.check.index.href(undefined, {
          searchParams: { email, ...(next ? { next } : {}) },
        }),
        303,
      )
    },
  },
})
