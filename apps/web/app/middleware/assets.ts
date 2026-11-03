import type { Middleware } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'

import { platform } from '#platform'

import { routes } from '../routes.ts'

const asset = createMatcher(routes.assets.pattern)

/**
 * An `/assets/*` response: Node compiles and serves them on demand; on
 * Workers, built assets are served by the platform before the Worker runs, so
 * a request that gets here is a miss.
 */
export async function assetResponse(request: Request): Promise<Response> {
  return (await platform.assets.fetch(request)) ?? new Response('Not Found', { status: 404 })
}

/**
 * Answers `GET`/`HEAD /assets/*` next to `serveMedia()` (decision 035): an
 * asset is public and the same for everyone, so it never reads D1 or the
 * session. In dev, a page loads dozens of modules and stylesheets; each one
 * reading the session made them fail (`SQLITE_BUSY`) when local D1 was busy,
 * and the page rendered unstyled. On Workers this only sees misses, which
 * get the same plain 404 as before, without the session read.
 */
export function serveAssets(): Middleware {
  return (context, next) => {
    if (context.method !== 'GET' && context.method !== 'HEAD') return next()
    if (!asset.match(context.url)) return next()
    return assetResponse(context.request)
  }
}
