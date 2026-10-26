import type { Middleware } from 'remix/router'

// Response headers for every Worker response (decision 020). Static assets
// never reach the Worker; their headers come from build/client/_headers.

/** On every response. */
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
}

/**
 * On HTML. Framing only by our own pages (the same-origin breakpoint iframes),
 * no plugins, no <base> hijack, forms post only here. No script-src or
 * style-src yet: every page has an inline import map and inline
 * `<style data-rmx-style>` tags, which a strict policy would need nonces for.
 */
export const CONTENT_SECURITY_POLICY = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"

/** Account and sign-in pages are never stored, not even by the browser. */
const NO_STORE_PATHS = /^\/(?:settings|me|login|auth|logout)(?:\/|$)/

/**
 * Sets the security headers, and a Cache-Control default on HTML: every page
 * may be personalized (the app bar, progress), so it is `private, no-cache`,
 * and `no-store` on account and sign-in pages. Headers an action already set
 * (the magic-link page's `no-referrer`, an explicit Cache-Control) win.
 */
export function responseHeaders(): Middleware {
  return async (context, next) => {
    let response = await next()
    let html = response.headers.get('Content-Type')?.includes('text/html') ?? false
    let set: [string, string][] = Object.entries(SECURITY_HEADERS)
    if (html) {
      set.push(['Content-Security-Policy', CONTENT_SECURITY_POLICY])
      set.push(['Cache-Control', NO_STORE_PATHS.test(context.url.pathname) ? 'no-store' : 'private, no-cache'])
    }
    let missing = set.filter(([name]) => !response.headers.has(name))
    if (!missing.length) return response
    let headers = new Headers(response.headers)
    for (let [name, value] of missing) headers.set(name, value)
    // A copy: some responses (Response.redirect) have immutable headers.
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}
