import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { platform } from '#platform'

import { errorFields, log } from '../log.ts'
import { rateLimit } from '../middleware/rate-limit.tsx'
import { routes } from '../routes.ts'
import { getViewer } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { loadCompleted } from '../progress/progress.ts'
import { receiveCspReport } from './csp-report.ts'
import { robotsResponse, sitemapResponse } from './site-files.ts'
import { HomePage } from './home-page.tsx'
import { continueHref, nextStep } from './home/continue.ts'
import { NotFoundPage } from '../ui/not-found-page.tsx'

export default createController(routes, {
  actions: {
    // Node serves compiled assets on demand. On Workers, built assets are
    // served by the platform before the Worker runs, so this only sees misses.
    async assets(context) {
      return (
        (await platform.assets.fetch(context.request)) ??
        new Response('Not Found', { status: 404 })
      )
    },
    // Liveness plus a D1 round trip, so a deploy check proves the binding.
    async health(context) {
      let database: 'ok' | 'error' = 'ok'
      try {
        await context.db.d1.prepare('select 1').first()
      } catch (error) {
        log('error', 'Health check: D1 failed', errorFields(error))
        database = 'error'
      }
      return Response.json(
        { ok: database === 'ok', runtime: platform.runtime, database },
        { status: database === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
      )
    },
    // CSP violation reports (decision 027): logged, never stored. The burst
    // limit keeps a noisy or hostile client from flooding the logs.
    cspReport: {
      middleware: [rateLimit('RL_REPORTS', () => new Response(null, { status: 429 }))],
      handler(context) {
        return receiveCspReport(context.request)
      },
    },
    // Normally answered by serveRobots() / serveSitemap() in router.ts first.
    robots(context) {
      return robotsResponse(context.url)
    },
    sitemap(context) {
      return sitemapResponse(context)
    },
    async home(context) {
      let viewer = getViewer(context)
      // Signed in, the landing opens on the learner's next lesson (decision 065).
      let next = viewer
        ? await Promise.all([getCatalog(context), loadCompleted(context)]).then(([catalog, completed]) =>
            nextStep(catalog, completed),
          )
        : undefined
      return context.render(<HomePage viewer={viewer} next={next} />)
    },
    // The header's "Continue" key (decision 065): one link on every page, so
    // no page loads progress just to draw the bar. Signed out, lesson 1.
    async continue(context) {
      let [catalog, completed] = await Promise.all([getCatalog(context), loadCompleted(context)])
      // Per learner and per moment: never cached.
      return redirect(continueHref(catalog, completed), { status: 303, headers: { 'Cache-Control': 'private, no-store' } })
    },
    notFound(context) {
      return context.render(<NotFoundPage path={context.url.pathname} viewer={getViewer(context)} />, {
        status: 404,
      })
    },
  },
})
