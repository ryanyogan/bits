import { createController } from 'remix/router'

import { getViewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'

export default createController(routes.styleguide, {
  actions: {
    // The catalogue renders every component with sample data; it loads on
    // the first visit, not with every isolate (decision 026).
    async index(context) {
      let { StyleguidePage } = await import('./styleguide-page.tsx')
      return context.render(<StyleguidePage currentPath={context.url.pathname} viewer={getViewer(context)} />, {
        headers: { 'X-Robots-Tag': 'noindex' },
      })
    },
  },
})
