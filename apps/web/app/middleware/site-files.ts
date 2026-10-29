import type { Middleware } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'

import { robotsResponse, sitemapResponse } from '../actions/site-files.ts'
import { routes } from '../routes.ts'

const robots = createMatcher(routes.robots.pattern)
const sitemap = createMatcher(routes.sitemap.pattern)

function isRead(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

/**
 * `GET /robots.txt`, next to `serveMedia()` (decision 035): public, the same
 * for everyone, and it needs neither D1 nor the session.
 */
export function serveRobots(): Middleware {
  return (context, next) => {
    if (!isRead(context.method) || !robots.match(context.url)) return next()
    return robotsResponse(context.url)
  }
}

/**
 * `GET /sitemap.xml`, right after `loadDatabase()`: it is built from the
 * published catalog (`getCatalog`, usually the isolate memo, else one D1
 * read), so it needs the db, but never the session, CSRF or form parsing.
 */
export function serveSitemap(): Middleware {
  return (context, next) => {
    if (!isRead(context.method) || !sitemap.match(context.url)) return next()
    return sitemapResponse(context)
  }
}
