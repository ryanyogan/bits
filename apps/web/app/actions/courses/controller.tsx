import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { PlaceholderPage } from '../../ui/placeholder-page.tsx'

export default createController(routes.courses, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title="Courses"
          pattern="/courses"
          artboard="Catalog"
          summary="The catalog. Track and search filters live in the URL (?track=agents&q=rag) so they can be shared; a Continue banner appears when there is any progress."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
