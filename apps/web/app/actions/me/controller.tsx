import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'

export default createController(routes.me, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title="Your profile"
          pattern="/me"
          artboard="Profile"
          summary="Private dashboard: stats, activity grid, courses, badges and the prompt journal. Requires a session."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
