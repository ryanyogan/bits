import { createController } from 'remix/router'

import { getContinue } from '../../data/fixtures.ts'
import { getViewer } from '../../auth/identity.ts'
import { routes } from '../../routes.ts'
import { filterCourses, parseCatalogQuery } from './catalog.ts'
import { CatalogPage, type ContinueTarget } from './catalog-page.tsx'

export default createController(routes.courses, {
  actions: {
    index(context) {
      let viewer = getViewer(context)
      let query = parseCatalogQuery(context.url)
      let { results, counts } = filterCourses(query)

      // Signed-in progress renders on the server. Anonymous (local) progress
      // will be filled in by a ProgressStore island later; render nothing now.
      let continueTarget: ContinueTarget | undefined
      if (viewer) {
        let { course, lesson, total } = getContinue()
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
