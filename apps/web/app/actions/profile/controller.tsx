import { css } from 'remix/component'
import { EmptyState } from '@bits/ui/empty-state'
import { Keycap } from '@bits/ui/keycap'
import { createController } from 'remix/router'

import { getViewer } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { getPublicProfile } from './data.ts'
import { ProfilePage } from './profile-page.tsx'

// Public profile. Shown only when the user made it public; a private or
// unknown handle is a 404 with the same message, so handles can't be probed.
export default createController(routes.profile, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      let profile = getPublicProfile(context.params.handle)
      if (!profile) {
        return context.render(
          <Layout title="Profile not found" viewer={viewer} currentPath={context.url.pathname}>
            <div mix={notFoundStyle}>
              <h1 class="sr-only">Profile not found</h1>
              <EmptyState
                title="This profile is private."
                hint="Or there’s no one with that handle."
                action={
                  <Keycap variant="ghost-mono" href={routes.courses.index.href()}>
                    Browse courses →
                  </Keycap>
                }
              />
            </div>
          </Layout>,
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

const notFoundStyle = css({ maxWidth: '640px', margin: '0 auto' })
