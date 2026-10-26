// Cloudflare Workers entry. Built by scripts/build.ts into build/worker/.
//
// Requests for files in build/client (fingerprinted /assets/*, favicon, ...)
// are answered by Workers Static Assets before this code runs; everything
// else reaches the router.
import { createD1Database, deleteExpiredAuthRows } from '@bits/db'

import { platform } from '#platform'

import { router } from './app/router.ts'

// One public address, so sessions and magic links don't split across hosts.
const legacyHosts = new Set(
  (platform.env.LEGACY_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
)

export default {
  async fetch(request: Request): Promise<Response> {
    let url = new URL(request.url)
    let canonical = platform.env.CANONICAL_ORIGIN
    if (canonical && legacyHosts.has(url.host)) {
      return Response.redirect(new URL(url.pathname + url.search, canonical).href, 301)
    }
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Unhandled request error',
          url: request.url,
          method: request.method,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : String(error),
        }),
      )
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  // Daily cron (wrangler.jsonc triggers): drop expired sessions and email tokens.
  async scheduled(): Promise<void> {
    await deleteExpiredAuthRows(createD1Database(platform.env.DB), Date.now())
  },
}
