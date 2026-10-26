import { createController } from 'remix/router'

import { getViewer } from '../../../auth/identity.ts'
import { routes } from '../../../routes.ts'
import { LessonPage } from './lesson-page.tsx'
import { buildLessonView } from './lesson-view.ts'
import { LessonNotFoundPage } from './ui/not-found.tsx'

export default createController(routes.courses.lesson, {
  actions: {
    index(context) {
      let view = buildLessonView(context.params.course, context.params.lesson, context.url, {
        viewer: getViewer(context),
      })
      if (!view) {
        return context.render(
          <LessonNotFoundPage course={context.params.course} currentPath={context.url.pathname} />,
          { status: 404 },
        )
      }
      return context.render(<LessonPage view={view} />)
    },
  },
})
