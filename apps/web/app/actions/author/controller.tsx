import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { getViewer } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'
import { AuthorPage } from './author-page.tsx'
import { getAuthoredCourses } from './data.ts'

// Authoring home. Requires the author role once auth lands; the UI build
// shows the demo viewer's courses.
export default createController(routes.author, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      if (!viewer) {
        return redirect(routes.login.index.href(undefined, { searchParams: { next: routes.author.index.href() } }), 303)
      }
      return context.render(
        <AuthorPage
          courses={getAuthoredCourses()}
          viewer={viewer}
          currentPath={context.url.pathname}
          repoSaved={context.url.searchParams.get('repo') === 'saved'}
        />,
      )
    },
    // Stub: saving sync settings lands with the GitHub webhook milestone.
    repo() {
      return redirect(routes.author.index.href(undefined, { searchParams: { repo: 'saved' } }), 303)
    },
  },
})
