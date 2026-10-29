import { createController } from 'remix/router'

import { getViewer } from '../../../auth/identity.ts'
import { getCatalog } from '../../../content/request.ts'
import { loadCompleted } from '../../../progress/progress.ts'
import { takeReward } from '../../../progress/reward.ts'
import { routes } from '../../../routes.ts'
import { trackSlug } from '../catalog.ts'
import { buildCourseView } from './course-data.ts'
import { CourseNotFoundPage } from './not-found-page.tsx'
import { CoursePage } from './course-page.tsx'

export default createController(routes.courses.course, {
  actions: {
    async index(context) {
      let viewer = getViewer(context)
      let coursesHref = routes.courses.index.href()
      let [catalog, completed] = await Promise.all([getCatalog(context), loadCompleted(context)])
      let course = catalog.getCourse(context.params.course, completed)

      if (!course) {
        return context.render(
          <CourseNotFoundPage slug={context.params.course} viewer={viewer} coursesHref={coursesHref} />,
          { status: 404 },
        )
      }

      let view = buildCourseView(course, viewer, (lesson) => routes.courses.lesson.index.href({ course: course.slug, lesson }))

      return context.render(
        <CoursePage
          view={view}
          viewer={viewer}
          reward={takeReward(context)}
          coursesHref={coursesHref}
          trackHref={routes.courses.index.href(undefined, {
            searchParams: { track: trackSlug(course.track) },
          })}
        />,
      )
    },
  },
})
