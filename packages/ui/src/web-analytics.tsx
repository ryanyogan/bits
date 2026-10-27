import type { Handle, RemixNode } from 'remix/component'

/** Cloudflare's Web Analytics beacon (decision 033). */
export const WEB_ANALYTICS_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'

export interface WebAnalyticsProps {
  /** The Web Analytics site token (public: it is in every page's HTML). */
  token: string
  children?: RemixNode
}

/**
 * Turns on Cloudflare Web Analytics for the server-rendered tree (decision
 * 033). The app wraps a page in it only when a site token is configured and
 * the visitor hasn't asked not to be tracked; `Document` then adds the beacon.
 * Without it (tests, dev, `Sec-GPC: 1`) no beacon is rendered.
 */
export function WebAnalytics(handle: Handle<WebAnalyticsProps, { token: string }>) {
  return () => {
    handle.context.set({ token: handle.props.token })
    return handle.props.children
  }
}

/** The site token from the nearest `WebAnalytics`, or undefined (analytics off). */
export function webAnalyticsToken(handle: Handle<any, any>): string | undefined {
  let value = handle.context.get(WebAnalytics) as { token: string } | undefined
  return value?.token
}
