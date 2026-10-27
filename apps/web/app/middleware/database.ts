import { createD1Database, createD1Meter, meterD1, type D1Database, type D1DataTableDatabase, type D1Meter } from '@bits/db'
import { createContextKey, type Middleware, type RequestContext } from 'remix/router'

import { log } from '../log.ts'

export const databaseContext = createContextKey<D1DataTableDatabase>()

/** D1 time above which a request is logged (decision 026). */
const SLOW_DB_MS = 250

/**
 * Puts the app database on request context as `context.db`, metered.
 *
 * Each request gets a data-table wrapper over a metered view of the shared
 * D1 binding (both are small objects; the binding holds the connection). The
 * meter becomes a `Server-Timing: db` entry on the response, so query counts
 * and sequential round trips are visible in devtools and `curl -I`, in dev
 * and production alike. Requests that spend long in D1 are also logged.
 */
export function loadDatabase(d1: D1Database): Middleware<{
  key: typeof databaseContext
  value: D1DataTableDatabase
  property: 'db'
}> {
  return async (context, next) => {
    let meter = createD1Meter()
    context.set(databaseContext, createD1Database(meterD1(d1, meter)), { property: 'db' })
    let response = await next()
    if (meter.calls === 0) return response
    if (meter.ms >= SLOW_DB_MS) {
      log('warn', 'Slow D1 request', { method: context.method, path: context.url.pathname, ...meter })
    }
    return withServerTiming(response, meter)
  }
}

/** `db;dur=12;desc="3 queries, 2 round trips"`. */
export function serverTiming(meter: D1Meter): string {
  return `db;dur=${meter.ms};desc="${meter.queries} queries, ${meter.waves} round trips"`
}

function withServerTiming(response: Response, meter: D1Meter): Response {
  try {
    response.headers.append('Server-Timing', serverTiming(meter))
    return response
  } catch {
    // Immutable headers (Response.redirect): copy.
    let headers = new Headers(response.headers)
    headers.append('Server-Timing', serverTiming(meter))
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}

/** `context.db` for helpers that take any request context. */
export function getDatabase(context: RequestContext<any, any>): D1DataTableDatabase {
  return context.get(databaseContext) as D1DataTableDatabase
}
