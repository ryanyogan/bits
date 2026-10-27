import { createController } from 'remix/router'

import { pageTitle } from '../../config.ts'
import { getCatalog } from '../../content/request.ts'
import { badgeDefinitions } from '../../progress/badges.ts'
import { routes } from '../../routes.ts'
import { CardPage, type CardContent } from './card-page.tsx'

// /cards/:card: `home`, `course-<slug>` or `certificate-<slug>`. The pages
// `pnpm og` turns into public/og/<card>.png (decision 028). Noindex.
export default createController(routes.cards, {
  actions: {
    async show(context) {
      let name = context.params.card
      let card: CardContent | undefined
      if (name === 'home') {
        card = { kind: 'home' }
      } else {
        let match = /^(course|certificate)-(.+)$/.exec(name)
        let catalog = await getCatalog(context)
        let course = match ? catalog.getCourse(match[2]!) : undefined
        if (match && course) {
          card =
            match[1] === 'course'
              ? { kind: 'course', course }
              : {
                  kind: 'certificate',
                  course,
                  badgeColor:
                    badgeDefinitions(catalog).find((badge) => badge.id === `course:${course.slug}`)?.color ??
                    'var(--volt)',
                }
        }
      }
      if (!card) return new Response('No such card', { status: 404 })
      return context.render(<CardPage card={card} title={pageTitle(`Card: ${name}`)} />, {
        headers: { 'X-Robots-Tag': 'noindex' },
      })
    },
  },
})
