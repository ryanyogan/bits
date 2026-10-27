import { createController } from 'remix/router'

import { getViewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { PrivacyPage } from './privacy-page.tsx'
import { TermsPage } from './terms-page.tsx'

// /terms and /privacy: static text, the same for everyone except the bar.
export default createController(routes.legal, {
  actions: {
    terms(context) {
      return context.render(<TermsPage viewer={getViewer(context)} />)
    },
    privacy(context) {
      return context.render(<PrivacyPage viewer={getViewer(context)} />)
    },
  },
})
