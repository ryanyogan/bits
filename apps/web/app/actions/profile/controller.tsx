import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'

export default createController(routes.profile, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title={`@${context.params.handle}`}
          pattern="/u/:handle"
          artboard="Profile (public)"
          summary="Public profile, shown only when the user has made it public. Never shows email or the prompt journal."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
