import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { platform } from '#platform'

import { errorFields, log } from '../log.ts'
import { assetResponse } from '../middleware/assets.ts'
import { rateLimit } from '../middleware/rate-limit.tsx'
import { routes } from '../routes.ts'
import { getViewer } from '../auth/identity.ts'
import { getCatalog } from '../content/request.ts'
import { loadCompleted } from '../progress/progress.ts'
import { receiveCspReport } from './csp-report.ts'
import { robotsResponse, sitemapResponse } from './site-files.ts'
import { HomePage } from './home-page.tsx'
import { continueHref, nextStep } from './home/continue.ts'
import { hasSessionProgress } from '../middleware/learner.tsx'
import { NotFoundPage } from '../ui/not-found-page.tsx'

export default createController(routes, {
  actions: {
    // Normally answered by serveAssets() in router.ts, before the session.
    assets(context) {
      return assetResponse(context.request)
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
      // With progress (signed in, or signed out with lessons done in the
      // session), the landing opens on the learner's next lesson (decisions
      // 065, 070). A fresh visitor needs neither read.
      let progress = viewer !== null || hasSessionProgress(context)
      let next =
        progress
          ? await Promise.all([getCatalog(context), loadCompleted(context)]).then(([catalog, completed]) =>
              nextStep(catalog, completed),
            )
          : undefined
      return context.render(<HomePage viewer={viewer} next={next} progress={progress} />)
    },
    // The header's "Continue" key (decision 065): one link on every page, so
    // no page loads progress just to draw the bar. Signed out, lesson 1.
    async continue(context) {
      let [catalog, completed] = await Promise.all([getCatalog(context), loadCompleted(context)])
      // Per learner and per moment: never cached.
      return redirect(continueHref(catalog, completed), { status: 303, headers: { 'Cache-Control': 'private, no-store' } })
    },
    // Any method (routes.ts): a POST to an unknown URL gets this page too.
    notFound(context) {
      return context.render(<NotFoundPage path={context.url.pathname} viewer={getViewer(context)} />, {
        status: 404,
      })
    },
  },
})
