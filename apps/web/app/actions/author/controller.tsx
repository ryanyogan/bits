import { createController } from 'remix/router'

import { canAuthor, requireUser, toViewer } from '../../auth/identity.ts'
import { contentBucket } from '../../content/request.ts'
import { routes } from '../../routes.ts'
import { ForbiddenPage } from '../../ui/not-found-page.tsx'
import { AuthorPage } from './author-page.tsx'
import { getManagedCourses } from './data.ts'

// Authoring home: authors see the courses they own, admins see every course.
// Learners get a 403 (authoring is invite-only in v1).
export default createController(routes.author, {
  middleware: [requireUser()],
  actions: {
    async index(context) {
      let user = context.auth.identity
      let viewer = toViewer(user)
      if (!canAuthor(user)) {
        return context.render(
          <ForbiddenPage viewer={viewer} hint="Writing courses is invite-only for now. Ask an admin for the author role." />,
          { status: 403 },
        )
      }
      return context.render(
        <AuthorPage
          courses={await getManagedCourses(context.db, contentBucket(), user)}
          viewer={viewer}
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
