import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { getViewer } from '../../../auth/identity.ts'
import { getCatalog } from '../../../content/request.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { readSubmission } from '../../../progress/check.ts'
import { loadDrafts } from '../../../progress/drafts.ts'
import { completeLesson, loadCompleted } from '../../../progress/progress.ts'
import { routes } from '../../../routes.ts'
import { LessonPage } from './lesson-page.tsx'
import { buildLessonView } from './lesson-view.ts'
import { LessonNotFoundPage } from './ui/not-found.tsx'

export default createController(routes.courses.lesson, {
  actions: {
    async index(context) {
      let { course, lesson } = context.params
      let [catalog, completed, drafts] = await Promise.all([
        getCatalog(context),
        loadCompleted(context),
        loadDrafts(context, course, lesson),
      ])
      let viewer = getViewer(context)
      let view = await buildLessonView(catalog, course, lesson, context.url, { viewer, completed, drafts })
      if (!view) {
        return context.render(
          <LessonNotFoundPage course={context.params.course} currentPath={context.url.pathname} viewer={viewer} />,
          { status: 404 },
        )
      }
      return context.render(<LessonPage view={view} />)
    },

    // "Complete lesson": re-run every check on the submitted prompts, save
    // the lesson (D1, or the session when signed out), continue onward.
    complete: {
      middleware: [rateLimit('RL_WRITES')],
      async handler(context) {
        let { course, lesson } = context.params
        let catalog = await getCatalog(context)
        let found = catalog.getLesson(course, lesson)
        let content = found && (await catalog.lessonContent(course, lesson))
        if (!found || !content) return new Response('Lesson not found', { status: 404 })
        let submission = readSubmission(context.formData, content)
        let result = await completeLesson(context, course, lesson, submission)
        if (!result) return new Response('Lesson not found', { status: 404 })

        let mode = context.formData.get('mode')
        let searchParams: Record<string, string | string[]> = typeof mode === 'string' && mode !== 'read' ? { mode } : {}

        if (!result.ok) {
          // Same page again, with the learner's quiz answers and what failed.
          for (let [quiz, keys] of Object.entries(submission.quizzes)) searchParams[`quiz-${quiz}`] = keys
          let url = new URL(routes.courses.lesson.index.href({ course, lesson }, { searchParams }), context.url)
          let view = (await buildLessonView(catalog, course, lesson, url, {
            viewer: getViewer(context),
            completed: await loadCompleted(context),
            drafts: await loadDrafts(context, course, lesson),
          }))!
          let issues = result.checked.exercises
            .filter((exercise) => !exercise.passed)
            .map((exercise) => `Not saved: “${exercise.failed.join('”, “')}” didn’t pass for “${exercise.task}”.`)
          return context.render(<LessonPage view={view} issues={issues} />, { status: 422 })
        }

        let next = found.next
        return redirect(
          next
            ? routes.courses.lesson.index.href({ course, lesson: next.slug }, { searchParams })
            : routes.courses.course.index.href({ course }),
          303,
        )
      },
    },
  },
})
