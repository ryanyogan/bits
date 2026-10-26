import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'

export default createController(routes.courses.course, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title={context.params.course}
          pattern="/courses/:course"
          artboard="Course"
          summary="Syllabus with each lesson state, outcomes, a progress ring and a badge preview."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
