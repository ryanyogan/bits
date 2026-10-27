import type { Middleware } from 'remix/router'

import { errorFields, log, requestFields } from '../log.ts'

/**
 * One `error` log line per 5xx (decision 039), with the method, path, status
 * and ray id, so a failure in Workers Logs or Workers Issues leads straight
 * to the request. Outermost but one in router.ts: it sits inside
 * responseHeaders(), so the 500 it answers still gets the security headers.
 *
 * - An action or middleware that throws: logged with the error (message
 *   and stack, email addresses redacted), answered with a plain 500 before
 *   any byte is sent (guide 12).
 * - A handler that returns a 5xx itself (a 503 from /health): logged
 *   without an error. Its own detail line, if any, stays as the cause.
 * - A request the client aborted: not an error; logged at info.
 *
 * Streaming render failures happen after the first byte and are logged by
 * render({ onError }). worker.ts keeps a last catch for anything outside
 * the router.
 */
export function logServerErrors(): Middleware {
  return async (context, next) => {
    let started = Date.now()
    let response: Response
    try {
      response = await next()
    } catch (error) {
      let fields = { ...requestFields(context.request), ms: Date.now() - started }
      if (context.request.signal.aborted) {
        log('info', 'Request aborted', fields)
        return new Response(null, { status: 499 })
      }
      log('error', 'Unhandled request error', { ...fields, status: 500, ...errorFields(error) })
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    if (response.status >= 500) {
      log('error', 'Server error response', {
        ...requestFields(context.request),
        status: response.status,
        ms: Date.now() - started,
      })
    }
    return response
  }
}
