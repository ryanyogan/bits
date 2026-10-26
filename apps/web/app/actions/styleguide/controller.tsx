import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { StyleguidePage } from './styleguide-page.tsx'

export default createController(routes.styleguide, {
  actions: {
    index(context) {
      return context.render(<StyleguidePage currentPath={context.url.pathname} />, {
        headers: { 'X-Robots-Tag': 'noindex' },
      })
    },
  },
})
