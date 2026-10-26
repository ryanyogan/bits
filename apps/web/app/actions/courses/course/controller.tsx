import { createController } from 'remix/router'

import { getCourse, getViewer } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'
import { trackSlug } from '../catalog.ts'
import { buildCourseView } from './course-data.ts'
import { CourseNotFoundPage } from './not-found-page.tsx'
import { CoursePage } from './course-page.tsx'

export default createController(routes.courses.course, {
  actions: {
    index(context) {
      let viewer = getViewer(context.url)
      // Keep the signed-out preview (`?as=anon`) on every link out of the page.
      let preview = viewer ? undefined : { as: 'anon' }
      let coursesHref = routes.courses.index.href(undefined, { searchParams: preview })
      let course = getCourse(context.params.course)

      if (!course) {
        return context.render(
          <CourseNotFoundPage slug={context.params.course} viewer={viewer} coursesHref={coursesHref} />,
          { status: 404 },
        )
      }

      let view = buildCourseView(course, viewer, (lesson, mode) =>
        routes.courses.lesson.index.href(
          { course: course.slug, lesson },
          { searchParams: { ...(mode ? { mode } : {}), ...preview } },
        ),
      )

      return context.render(
        <CoursePage
          view={view}
          viewer={viewer}
          coursesHref={coursesHref}
          trackHref={routes.courses.index.href(undefined, {
            searchParams: { track: trackSlug(course.track), ...preview },
          })}
        />,
      )
    },
  },
})
