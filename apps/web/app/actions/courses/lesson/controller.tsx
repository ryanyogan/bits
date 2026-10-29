import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { currentUser, getViewer } from '../../../auth/identity.ts'
import { getCatalog } from '../../../content/request.ts'
import { rateLimit } from '../../../middleware/rate-limit.tsx'
import { passedAsks, takeVerdict } from '../../../progress/ask-session.ts'
import { lessonDepth } from '../../../progress/depth.ts'
import { readSubmission } from '../../../progress/check.ts'
import { loadDrafts } from '../../../progress/drafts.ts'
import { completeLesson, loadCompleted } from '../../../progress/progress.ts'
import { flashReward, rewardNotice, savedNotice, takeReward } from '../../../progress/reward.ts'
import { routes } from '../../../routes.ts'
import { buildLessonView } from './lesson-view.ts'
import { LessonNotFoundPage } from './ui/not-found.tsx'

// The lesson page (its islands, the editor, the video player)
// loads on the first lesson request, not at isolate startup (decision 026).
const lessonPage = () => import('./lesson-page.tsx')

export default createController(routes.courses.lesson, {
  actions: {
    async index(context) {
      let { course, lesson } = context.params
      let [catalog, completed, drafts, depth] = await Promise.all([
        getCatalog(context),
        loadCompleted(context),
        loadDrafts(context, course, lesson),
        lessonDepth(context),
      ])
      let viewer = getViewer(context)
      // Quick checks answered right, and a verdict flashed back to a native answer (decision 052).
      let asks = { passed: passedAsks(context, course, lesson), verdict: takeVerdict(context, course, lesson) }
      let view = await buildLessonView(catalog, course, lesson, context.url, { viewer, completed, drafts, asks, depth })
      if (!view) {
        return context.render(
          <LessonNotFoundPage course={context.params.course} currentPath={context.url.pathname} viewer={viewer} />,
          { status: 404 },
        )
      }
      let { LessonPage } = await lessonPage()
      return context.render(<LessonPage view={view} reward={takeReward(context)} />)
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

        if (!result.ok) {
          // Same page again, with what failed.
          let url = new URL(routes.courses.lesson.index.href({ course, lesson }), context.url)
          let [completed, drafts, depth] = await Promise.all([
            loadCompleted(context),
            loadDrafts(context, course, lesson),
            lessonDepth(context),
          ])
          let view = (await buildLessonView(catalog, course, lesson, url, {
            viewer: getViewer(context),
            completed,
            drafts,
            asks: { passed: passedAsks(context, course, lesson) },
            depth,
          }))!
          let issues = [
            ...result.checked.exercises
              .filter((exercise) => !exercise.passed)
              .map((exercise) => `Not saved: “${exercise.failed.join('”, “')}” didn’t pass for “${exercise.task}”.`),
            ...(result.checked.unanswered.length
              ? [
                  result.checked.unanswered.length === 1
                    ? 'Not saved: answer the quick check first.'
                    : `Not saved: answer the ${result.checked.unanswered.length} quick checks first.`,
                ]
              : []),
          ]
          let { LessonPage } = await lessonPage()
          return context.render(<LessonPage view={view} issues={issues} />, { status: 422 })
        }

        let next = found.next
        let target = next
          ? routes.courses.lesson.index.href({ course, lesson: next.slug })
          : routes.courses.course.index.href({ course })
        // The page we land on shows what the save earned: new badges
        // (decision 028), else the neurons it added (decision 052).
        let user = currentUser(context)
        let loginHref = routes.login.index.href(undefined, { searchParams: { next: target } })
        flashReward(
          context,
          (user && rewardNotice(result.badges, user.handle)) || savedNotice(result.newXp, Boolean(user), loginHref),
        )
        return redirect(target, 303)
      },
    },
  },
})
