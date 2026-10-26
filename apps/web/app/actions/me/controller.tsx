import { createController } from 'remix/router'

import { requireUser, toViewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { getOwnProfile } from '../profile/data.ts'
import { ProfilePage } from '../profile/profile-page.tsx'

// The private profile dashboard. `?tab=journal` shows the whole prompt
// journal (resolutions §10: no separate route).
export default createController(routes.me, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let viewer = toViewer(context.auth.identity)
      let profile = await getOwnProfile(context.db, context.auth.identity)
      let tab: 'journal' | 'overview' = context.url.searchParams.get('tab') === 'journal' ? 'journal' : 'overview'
      return context.render(
        <ProfilePage
          profile={profile}
          variant="own"
          tab={tab}
          viewer={viewer}
          shareUrl={new URL(routes.profile.index.href({ handle: profile.handle }), context.url).href}
          currentPath={context.url.pathname}
          title={tab === 'journal' ? 'Prompt journal' : 'Your profile'}
        />,
      )
    },
  },
})
