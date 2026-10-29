import { createController } from 'remix/router'

import { getViewer } from '../../auth/identity.ts'
import { getCatalog } from '../../content/request.ts'
import { routes } from '../../routes.ts'
import { StatusPage } from '../../ui/not-found-page.tsx'
import { getPublicProfile } from './data.ts'
import { ProfilePage } from './profile-page.tsx'

// Public profile. Shown only when the user made it public; a private or
// unknown handle is a 404 with the same message, so handles can't be probed.
export default createController(routes.profile, {
  actions: {
    async index(context) {
      let viewer = getViewer(context)
      let profile = await getPublicProfile(context.db, await getCatalog(context), context.params.handle)
      if (!profile) {
        return context.render(
          <StatusPage
            title="Profile not found"
            code="404"
            eyebrow="Private or unknown"
            heading="This profile is private."
            hint="Or there’s no one with that handle."
            viewer={viewer}
            currentPath={context.url.pathname}
          />,
          { status: 404 },
        )
      }
      let path = routes.profile.index.href({ handle: profile.handle })
      return context.render(
        <ProfilePage
          profile={profile}
          variant="public"
          viewer={viewer}
          shareUrl={new URL(path, context.url).href}
          currentPath={context.url.pathname}
          title={`${profile.name} (@${profile.handle})`}
        />,
      )
    },
  },
})
