import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'

export default createController(routes.author.course, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title={`Build: ${context.params.course}`}
          pattern="/author/:course"
          artboard="Authoring"
          summary="Validation report for the latest build, a preview link and Publish. Requires the author role."
          currentPath={context.url.pathname}
        />,
      )
    },
    preview(context) {
      return context.render(
        <PlaceholderPage
          title={`Draft: ${context.params.course} / ${context.params.lesson}`}
          pattern="/author/:course/preview/:lesson"
          artboard="Lesson"
          summary="Renders a draft version of the lesson under a Draft banner. Requires the author role."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
