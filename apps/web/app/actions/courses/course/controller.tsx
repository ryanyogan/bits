import { createController } from 'remix/router'

import { getCourse } from '../../../data/fixtures.ts'
import { getViewer } from '../../../auth/identity.ts'
import { routes } from '../../../routes.ts'
import { trackSlug } from '../catalog.ts'
import { buildCourseView } from './course-data.ts'
import { CourseNotFoundPage } from './not-found-page.tsx'
import { CoursePage } from './course-page.tsx'

export default createController(routes.courses.course, {
  actions: {
    index(context) {
      let viewer = getViewer(context)
      let coursesHref = routes.courses.index.href()
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
          { searchParams: mode ? { mode } : undefined },
        ),
      )

      return context.render(
        <CoursePage
          view={view}
          viewer={viewer}
          coursesHref={coursesHref}
          trackHref={routes.courses.index.href(undefined, {
            searchParams: { track: trackSlug(course.track) },
          })}
        />,
      )
    },
  },
})
