import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { getViewer } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'
import { getOwnProfile } from '../profile/data.ts'
import { ProfilePage } from '../profile/profile-page.tsx'

// The private profile dashboard. `?tab=journal` shows the whole prompt
// journal (resolutions §10: no separate route).
export default createController(routes.me, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      if (!viewer) {
        return redirect(routes.login.index.href(undefined, { searchParams: { next: routes.me.index.href() } }), 303)
      }
      let profile = getOwnProfile(viewer)
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
