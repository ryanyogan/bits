import { createController } from 'remix/router'

import { getViewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { StyleguidePage } from './styleguide-page.tsx'

export default createController(routes.styleguide, {
  actions: {
    index(context) {
      return context.render(<StyleguidePage currentPath={context.url.pathname} viewer={getViewer(context)} />, {
        headers: { 'X-Robots-Tag': 'noindex' },
      })
    },
  },
})
