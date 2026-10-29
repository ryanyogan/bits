import type { Middleware } from 'remix/router'

import { contentServerTiming } from '../content/request.ts'
import { appendServerTiming } from './database.ts'

/**
 * `Server-Timing: catalog` and `r2` for a request that resolved the published
 * catalog (decision 026): whether it came from the isolate's memo, a stale
 * memo or a cold load, and the content R2 reads the request waited for.
 * Registered just outside `loadDatabase`, so the entries follow `db`.
 */
export function contentTiming(): Middleware {
  return async (context, next) => {
    let response = await next()
    return appendServerTiming(response, contentServerTiming(context))
  }
}
