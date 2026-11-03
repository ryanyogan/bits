import { createController } from 'remix/router'

import { canAuthor, getViewer } from '../../auth/identity.ts'
import { getCatalog } from '../../content/request.ts'
import { loadCompleted } from '../../progress/progress.ts'
import { routes } from '../../routes.ts'
import { catalogSummary, filterCourses, parseCatalogQuery } from './catalog.ts'
import { CatalogPage, type ContinueTarget } from './catalog-page.tsx'

export default createController(routes.courses, {
  actions: {
    async index(context) {
      let viewer = getViewer(context)
      let query = parseCatalogQuery(context.url)
      // Progress is on the server for everyone: D1 when signed in, the
      // session when not (decision 016).
      let [catalog, completed] = await Promise.all([getCatalog(context), loadCompleted(context)])
      let all = catalog.listCourses(completed)
      let { results, counts } = filterCourses(query, all)
      let filtered = Boolean(query.track || query.q)

      let continueTarget: ContinueTarget | undefined
      // A filtered list is a search: the banner would sit between the
      // toolbar's answer and the question.
      let resume = filtered ? undefined : catalog.getContinue(completed)
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
          summary={catalogSummary(all)}
          suggestions={results.length === 0 ? all.slice(0, 3) : []}
          canWrite={viewer ? canAuthor(viewer) : false}
          courseHref={(slug) => routes.courses.course.index.href({ course: slug })}
        />,
      )
    },
  },
})
