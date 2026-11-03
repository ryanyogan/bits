import { createController } from 'remix/router'

import { getViewer } from '../../../auth/identity.ts'
import { getCatalog } from '../../../content/request.ts'
import { loadCompleted } from '../../../progress/progress.ts'
import { takeReward } from '../../../progress/reward.ts'
import { routes } from '../../../routes.ts'
import { exercisesOf } from '../lesson/content.ts'
import { trackSlug } from '../catalog.ts'
import { buildCourseView, pickNextCourse } from './course-data.ts'
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

      let slug = course.slug
      let all = course.modules.flatMap((m) => m.lessons)
      let finished = all.length > 0 && all.every((l) => l.state === 'done')
      let current = all.find((l) => l.state === 'current')
      // The resume callout names the current lesson's own exercise: one
      // lesson body, memoised per isolate (store.ts), only for a started course.
      let content = current ? await catalog.lessonContent(slug, current.slug) : undefined
      let currentExercise = content ? exercisesOf(content)[0]?.task : undefined
      let next = finished ? pickNextCourse(slug, catalog.listCourses(completed)) : undefined

      let view = buildCourseView(course, viewer, {
        lessonHref: (lesson) => routes.courses.lesson.index.href({ course: slug, lesson }),
        loginHref: routes.login.index.href(undefined, {
          searchParams: { next: routes.courses.course.index.href({ course: slug }) },
        }),
        certificateHref:
          finished && viewer ? routes.certificates.show.href({ handle: viewer.handle, course: slug }) : undefined,
        next: next ? { title: next.title, href: routes.courses.course.index.href({ course: next.slug }) } : undefined,
        currentExercise,
      })

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
