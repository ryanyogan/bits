// Cloudflare Workers entry. Built by scripts/build.ts into build/worker/.
//
// Requests for files in build/client (fingerprinted /assets/*, favicon, ...)
// are answered by Workers Static Assets before this code runs; everything
// else reaches the router.
import { createD1Database, deleteExpiredAuthRows, deleteOldAnonymousRuns } from '@bits/db'

import { platform } from '#platform'

import { canonicalRedirect } from './app/canonical-host.ts'
import { errorFields, log } from './app/log.ts'
import { router } from './app/router.ts'

/** Signed-out runs are only needed for the hourly limits and the run checks. */
const ANONYMOUS_RUNS_KEPT_MS = 7 * 24 * 60 * 60 * 1000

export default {
  async fetch(request: Request): Promise<Response> {
    // One public address: legacy and Version URL hosts 301 to it.
    let redirect = canonicalRedirect(new URL(request.url), platform.env)
    if (redirect) return Response.redirect(redirect, 301)
    try {
      return await router.fetch(request)
    } catch (error) {
      log('error', 'Unhandled request error', { url: request.url, method: request.method, ...errorFields(error) })
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  // Daily cron (wrangler.jsonc triggers): drop expired sessions and email
  // tokens, and signed-out prompt runs older than a week (decision 019).
  async scheduled(controller: { cron: string }): Promise<void> {
    let db = createD1Database(platform.env.DB)
    let now = Date.now()
    try {
      await deleteExpiredAuthRows(db, now)
      await deleteOldAnonymousRuns(db, now - ANONYMOUS_RUNS_KEPT_MS)
      log('info', 'Cleanup cron finished', { cron: controller.cron, ms: Date.now() - now })
    } catch (error) {
      log('error', 'Cleanup cron failed', { cron: controller.cron, ...errorFields(error) })
      throw error
    }
  },
}
