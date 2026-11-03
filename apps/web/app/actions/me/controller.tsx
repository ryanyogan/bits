import { createController } from 'remix/router'
import { Session } from 'remix/session'

import { requireUser, toViewer } from '../../auth/identity.ts'
import { profileLoadedWith } from '../../auth/session.ts'
import { getCatalog } from '../../content/request.ts'
import { loadCompleted } from '../../progress/progress.ts'
import { routes } from '../../routes.ts'
import { getOwnProfile } from '../profile/data.ts'
import { ProfilePage } from '../profile/profile-page.tsx'
import { nextStep } from '../home/continue.ts'
import { NextLessonBand } from './next-lesson.tsx'

// "My learning": the next lesson first, then the private profile dashboard
// (decision 068). `?tab=journal` shows the whole prompt journal
// (resolutions §10: no separate route).
export default createController(routes.me, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let viewer = toViewer(context.auth.identity)
      // The rows came with the session read (router.ts, decision 035).
      let user = context.auth.identity
      let rows = profileLoadedWith(context.get(Session), user.id)
      let catalog = await getCatalog(context)
      let profile = await getOwnProfile(context.db, catalog, user, rows)
      let tab: 'journal' | 'overview' = context.url.searchParams.get('tab') === 'journal' ? 'journal' : 'overview'
      // The completed lessons came with the profile rows; no extra read.
      let completed = rows
        ? new Map(rows.completed.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
        : await loadCompleted(context)
      let next = tab === 'overview' ? nextStep(catalog, completed) : undefined
      return context.render(
        <ProfilePage
          profile={profile}
          variant="own"
          tab={tab}
          viewer={viewer}
          shareUrl={new URL(routes.profile.index.href({ handle: profile.handle }), context.url).href}
          currentPath={context.url.pathname}
          title={tab === 'journal' ? 'Prompt journal' : 'My learning'}
          lead={next ? <NextLessonBand next={next} /> : undefined}
        />,
      )
    },
  },
})
