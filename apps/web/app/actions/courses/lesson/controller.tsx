import { createController } from 'remix/router'

import { routes } from '../../../routes.ts'
import { PlaceholderPage } from '../../../ui/placeholder-page.tsx'

export default createController(routes.courses.lesson, {
  actions: {
    index(context) {
      return context.render(
        <PlaceholderPage
          title={`${context.params.course} / ${context.params.lesson}`}
          pattern="/courses/:course/:lesson"
          artboard="Lesson, CodeLesson"
          summary="A lesson in Read, Watch or Terminal mode (?mode=read|watch|terminal). Lesson text renders on the server; only the islands it uses hydrate."
          currentPath={context.url.pathname}
        />,
      )
    },
  },
})
