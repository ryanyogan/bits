import { WebAnalytics } from '@bits/ui/web-analytics'
import { Renderer, type RenderFunction } from 'remix/middleware/render'
import type { Middleware } from 'remix/router'

import { platform } from '#platform'

/** Where the beacon sends its reports (Cloudflare's documented `connect-src`). */
export const WEB_ANALYTICS_CONNECT_SRC = 'https://cloudflareinsights.com'

/**
 * The Cloudflare Web Analytics site token (the `WEB_ANALYTICS_TOKEN` var), or
 * undefined when analytics is off: unset, empty, and always in tests and dev
 * unless a var sets it (decision 033).
 */
export function webAnalyticsToken(): string | undefined {
  let token = platform.env.WEB_ANALYTICS_TOKEN?.trim()
  return token ? token : undefined
}

/** True when the visitor's browser sends Global Privacy Control (`Sec-GPC: 1`). */
export function optsOut(request: Request): boolean {
  return request.headers.get('Sec-GPC')?.trim() === '1'
}

/**
 * Wraps `context.render` so pages render inside `<WebAnalytics>`, where
 * `Document` adds the beacon. Only when a token is set and the visitor hasn't
 * sent `Sec-GPC: 1`. Goes after `cspNonce()`, so the beacon gets the nonce.
 */
export function webAnalytics(): Middleware {
  return (context, next) => {
    let token = webAnalyticsToken()
    let render = context.get(Renderer) as RenderFunction | undefined
    if (token && render && !optsOut(context.request)) {
      let wrapped: RenderFunction = (node, init) => render(<WebAnalytics token={token}>{node}</WebAnalytics>, init)
      context.set(Renderer, wrapped, { property: 'render' })
    }
    return next()
  }
}
