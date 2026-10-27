import type { Middleware } from 'remix/router'

import { platform } from '#platform'
import type { PlatformCsp } from '../platform/types.ts'

import { cspNonceContext, createNonce } from './csp-nonce.tsx'

// Response headers for every Worker response (decisions 020 and 027). Static
// assets never reach the Worker; their headers come from build/client/_headers.

/** On every response. */
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
}

/** Where browsers send violation reports (`report-uri`). */
export const CSP_REPORT_PATH = '/csp-report'

/**
 * The strict, nonce-based policy for HTML (decision 027).
 *
 * - Scripts: only the ones carrying this response's nonce (the import map and
 *   the entry module, see `Document`), and whatever they load
 *   (`'strict-dynamic'`: islands, three.js, the import-map polyfill's blob
 *   modules). `'wasm-unsafe-eval'` is for the polyfill's lexer. `https:` and
 *   `'unsafe-inline'` are ignored by every browser that knows nonces; they only
 *   keep ancient ones working.
 * - Styles: our stylesheets plus inline `<style>` and `style=""`. Remix 3.1
 *   emits `<style data-rmx-style>` without a nonce, and a nonce in `style-src`
 *   would switch `'unsafe-inline'` off.
 * - Everything else is this origin only: fonts, images (and SVG data URIs),
 *   `/api/run`, the passkey endpoints. AI Gateway is called from the Worker.
 * - `frame-ancestors 'self'`, not `'none'`: same-origin breakpoint iframes.
 *   `form-action 'self'`: OAuth starts are links, not forms.
 */
export function contentSecurityPolicy(nonce: string, csp: PlatformCsp = platform.csp): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    ["connect-src 'self'", ...csp.connectSrc].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // report-uri only: with `report-to` as well, Chrome ignores report-uri and
    // batches through the Reporting API, which never delivered in testing.
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ')
}

/** Account and sign-in pages are never stored, not even by the browser. */
const NO_STORE_PATHS = /^\/(?:settings|me|login|auth|logout)(?:\/|$)/

/**
 * Sets the security headers, and on HTML the CSP and a Cache-Control default:
 * every page may be personalized (the app bar, progress), so it is `private,
 * no-cache`, and `no-store` on account and sign-in pages. Headers an action
 * already set (the magic-link page's `no-referrer`, an explicit Cache-Control)
 * win.
 *
 * It also makes this request's CSP nonce (`cspNonceContext`); the renderer
 * (`cspNonce()` in csp-nonce.tsx) hands it to the page.
 */
export function responseHeaders(): Middleware {
  return async (context, next) => {
    let nonce = createNonce()
    context.set(cspNonceContext, nonce)
    let response = await next()
    let html = response.headers.get('Content-Type')?.includes('text/html') ?? false
    let set: [string, string][] = Object.entries(SECURITY_HEADERS)
    if (html) {
      let header = platform.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
      set.push([header, contentSecurityPolicy(nonce)])
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
