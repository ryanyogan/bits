import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'

export default createController(routes.author, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title="Authoring"
          pattern="/author"
          artboard="Authoring"
          summary="The author’s courses, folder upload and repo connection. Requires the author role."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
