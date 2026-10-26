import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'

export default createController(routes.settings, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title="Settings"
          pattern="/settings"
          summary="Email, sign-in methods (passkeys and providers), the public-profile toggle, sign out everywhere, data export and account deletion. Requires a session."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
