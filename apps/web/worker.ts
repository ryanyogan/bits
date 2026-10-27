// Cloudflare Workers entry. Built by scripts/build.ts into build/worker/.
//
// Requests for files in build/client (fingerprinted /assets/*, favicon, ...)
// are answered by Workers Static Assets before this code runs; everything
// else reaches the router.
import { createD1Database } from '@bits/db'

import { platform } from '#platform'

import { canonicalRedirect } from './app/canonical-host.ts'
import { runHousekeeping } from './app/housekeeping/housekeeping.ts'
import { errorFields, log, requestFields } from './app/log.ts'
import { router } from './app/router.ts'

export default {
  async fetch(request: Request): Promise<Response> {
    // One public address: legacy and Version URL hosts 301 to it.
    let redirect = canonicalRedirect(new URL(request.url), platform.env)
    if (redirect) return Response.redirect(redirect, 301)
    try {
      return await router.fetch(request)
    } catch (error) {
      // The router's logServerErrors() answers throws from actions and
      // middleware; this catches the rest (its own outer middleware).
      log('error', 'Unhandled request error', { ...requestFields(request), status: 500, ...errorFields(error) })
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  // Daily cron (wrangler.jsonc triggers, decision 039): expired sessions,
  // tokens, challenges, old signed-out runs and mail counters, and video
  // uploads that never finished.
  async scheduled(controller: ScheduledController): Promise<void> {
    await runHousekeeping({
      db: createD1Database(platform.env.DB),
      bucket: platform.env.CONTENT,
      now: controller.scheduledTime,
      cron: controller.cron,
    })
  },
}
