import type { Middleware } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../routes.ts'
import { serveVideo } from '../video/serve.ts'

const video = createMatcher(routes.media.video.pattern)

/**
 * Answers `GET`/`HEAD /media/videos/:id.mp4` before the rest of the router
 * middleware runs (decision 035). A video is public, keyed by an immutable
 * id, and guarded only by the hotlink check, so it needs no session, no D1,
 * no CSRF check and no form parsing. Without this, every Range request a
 * `<video>` makes (each seek, each chunk) paid a session read.
 *
 * It sits right after `responseHeaders()`, so videos still get the security
 * headers (nosniff, HSTS, ...). It is router middleware, not a branch in
 * `worker.ts`, so Node (dev, tests) and Workers take the same path.
 */
export function serveMedia(): Middleware {
  return (context, next) => {
    if (context.method !== 'GET' && context.method !== 'HEAD') return next()
    let match = video.match(context.url)
    if (!match) return next()
    return serveVideo(context.request, match.params.id)
  }
}
