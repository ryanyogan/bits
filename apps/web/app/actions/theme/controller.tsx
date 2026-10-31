import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { getViewer } from '../../auth/identity.ts'
import { rateLimit } from '../../middleware/rate-limit.tsx'
import { rememberTheme } from '../../progress/theme.ts'
import { routes } from '../../routes.ts'
import { StatusPage } from '../../ui/not-found-page.tsx'
import { themeForm } from './schema.ts'

// POST only (cross-origin POSTs are stopped by cop() in the router). The
// answer is always the landing, the one page with this switch: the target
// never comes from the request, so this can't be an open redirect.
export default createController(routes.theme, {
  actions: {
    action: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let parsed = s.parseSafe(themeForm, context.formData)
        if (!parsed.success) {
          return context.render(
            <StatusPage
              title="Unknown theme"
              code="422"
              eyebrow="Not saved"
              heading="That isn't a theme."
              viewer={getViewer(context)}
              hint="Pick System, Dark or Light."
            />,
            { status: 422 },
          )
        }
        await rememberTheme(context, parsed.value.theme)
        return redirect(routes.home.href(), 303)
      },
    },
  },
})
