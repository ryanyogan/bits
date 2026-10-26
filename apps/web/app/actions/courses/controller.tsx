import { createController } from 'remix/router'

import { getContinue, listCourses } from '../../data/fixtures.ts'
import { getViewer } from '../../auth/identity.ts'
import { loadCompleted } from '../../progress/progress.ts'
import { routes } from '../../routes.ts'
import { filterCourses, parseCatalogQuery } from './catalog.ts'
import { CatalogPage, type ContinueTarget } from './catalog-page.tsx'

export default createController(routes.courses, {
  actions: {
    async index(context) {
      let viewer = getViewer(context)
      let query = parseCatalogQuery(context.url)
      // Progress is on the server for everyone: D1 when signed in, the
      // session when not (decision 016).
      let completed = await loadCompleted(context)
      let { results, counts } = filterCourses(query, listCourses(completed))

      let continueTarget: ContinueTarget | undefined
      let resume = getContinue(completed)
      if (resume) {
        let { course, lesson, total } = resume
        continueTarget = {
          href: routes.courses.lesson.index.href({ course: course.slug, lesson: lesson.slug }),
          courseTitle: course.title,
          lessonTitle: lesson.title,
          n: lesson.n,
          total,
          mins: lesson.mins,
          pct: course.pct,
          sigil: course.sigil,
          tone: course.tone,
          pattern: course.pattern,
        }
      }

      return context.render(
        <CatalogPage
          viewer={viewer}
          query={query}
          results={results}
          counts={counts}
          continueTarget={continueTarget}
          courseHref={(slug) => routes.courses.course.index.href({ course: slug })}
        />,
      )
    },
  },
})
