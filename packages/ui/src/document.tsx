import type { Handle, RemixNode } from 'remix/component'
import { ImportMap, type ImportMapData } from 'remix/component/server'

import { cspNonce } from './csp-nonce.tsx'
import { WEB_ANALYTICS_BEACON_SRC, webAnalyticsToken } from './web-analytics.tsx'

/** The browser runtime entry, as returned by the app's asset layer. */
export interface DocumentScriptEntry {
  href: string
  preloads: string[]
  importMap: ImportMapData
}

/** Resolved public URLs the document needs. Produced by the app, never hard-coded. */
export interface DocumentAssets {
  /** Browser runtime entry (boots hydration for client entries). */
  entry: DocumentScriptEntry
  /** Global stylesheets in cascade order (tokens, fonts, base). */
  stylesheets: string[]
  /** woff2 URLs worth preloading for first paint. */
  fontPreloads: string[]
}

export interface DocumentProps {
  assets: DocumentAssets
  /** Full `<title>`, already including the app name. */
  title: string
  description?: string
  /**
   * Absolute canonical URL of the page: `<link rel="canonical">` and
   * `og:url`. Omit for pages that shouldn't be shared (or outside production).
   */
  url?: string
  /** `og:site_name`, the app's name (passed in; the UI package has no brand). */
  siteName?: string
  /**
   * The link-preview card: an absolute PNG URL, its alt text and size. With
   * one, X shows the large card (`summary_large_image`); without, `summary`.
   */
  image?: DocumentImage
  /** Extra `<head>` content for the page (meta, preloads). */
  head?: RemixNode
  children?: RemixNode
}

export interface DocumentImage {
  url: string
  alt: string
  width: number
  height: number
}

/** Must match the order at the top of styles/tokens.css. */
const LAYER_ORDER = '@layer reset, tokens, base, rmx-reset, rmx, app;'

/**
 * The HTML document shell every page renders through. Dark only.
 *
 * The layer order is declared inline first so it is established before any
 * stylesheet or Remix's generated `rmx` styles load.
 *
 * Scripts carry the response's CSP nonce from `CspNonce` (decision 027): the
 * import map (Remix's runtime copies its nonce onto the maps it adds during
 * client navigation) and the entry module, whose imports inherit its trust.
 * Inline styles need no nonce: the policy allows them (`style-src
 * 'unsafe-inline'`), since Remix's `<style data-rmx-style>` tags carry none.
 *
 * Every `<link>` and `<script>` here takes a `data-rmx-key` (rel + href).
 * Client navigation diffs `<head>` and pairs unkeyed siblings by position,
 * so a page with one extra preload shifts every later link onto its
 * neighbour: each gets its `rel`/`href` rewritten in place and refetched
 * (a modulepreload briefly a stylesheet of JS, a font a module). Keyed, a
 * link is kept when the next page has it and replaced when it doesn't.
 * Nonced ones keep their `nonce` (`data-rmx-preserve-attrs`): browsers hide
 * it after load, so the diff would otherwise rewrite it every navigation.
 *
 * Inside `WebAnalytics` it adds Cloudflare's Web Analytics beacon (decision
 * 033), as Cloudflare documents it for manual setup: a module script
 * (deferred, fetched with CORS) with the site token in `data-cf-beacon`. It
 * carries the nonce, so `'strict-dynamic'` lets it run; it reports to
 * `cloudflareinsights.com` (the app's `connect-src`). Its single-page
 * tracking follows the Navigation API's `navigate` events, which is how
 * Remix's client navigation moves between pages.
 */
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { assets, title, description, url, siteName, image, head, children } = handle.props
    let { entry, stylesheets, fontPreloads } = assets
    let nonce = cspNonce(handle)
    let analyticsToken = webAnalyticsToken(handle)

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#0F131A" />
          <title>{title}</title>
          {description ? <meta name="description" content={description} /> : null}
          {url ? <link data-rmx-key="canonical" rel="canonical" href={url} /> : null}
          {/* Link previews (Open Graph; X reads these too). */}
          <meta property="og:type" content="website" />
          <meta property="og:title" content={title} />
          {description ? <meta property="og:description" content={description} /> : null}
          {url ? <meta property="og:url" content={url} /> : null}
          {siteName ? <meta property="og:site_name" content={siteName} /> : null}
          {image ? (
            <>
              <meta property="og:image" content={image.url} />
              <meta property="og:image:type" content="image/png" />
              <meta property="og:image:width" content={String(image.width)} />
              <meta property="og:image:height" content={String(image.height)} />
              <meta property="og:image:alt" content={image.alt} />
            </>
          ) : null}
          <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
          {/* The .ico for browsers without SVG favicons (older Safari); sizes="32x32" keeps SVG-capable ones on the SVG. */}
          <link data-rmx-key="icon-ico" rel="icon" href="/favicon.ico" sizes="32x32" />
          <link data-rmx-key="icon" rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <style>{LAYER_ORDER}</style>
          {fontPreloads.map((href) => (
            <link key={href} data-rmx-key={`preload:${href}`} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
          ))}
          {stylesheets.map((href) => (
            <link key={href} data-rmx-key={`stylesheet:${href}`} rel="stylesheet" href={href} />
          ))}
          {head}
          <ImportMap value={entry.importMap} nonce={nonce} />
          {entry.preloads.map((href) => (
            <link key={href} data-rmx-key={`modulepreload:${href}`} rel="modulepreload" href={href} nonce={nonce} data-rmx-preserve-attrs="nonce" />
          ))}
          <script data-rmx-key="entry" data-rmx-preserve-attrs="nonce" type="module" src={entry.href} nonce={nonce}></script>
          {analyticsToken ? (
            <script
              data-rmx-key="web-analytics"
              data-rmx-preserve-attrs="nonce"
              type="module"
              src={WEB_ANALYTICS_BEACON_SRC}
              data-cf-beacon={JSON.stringify({ token: analyticsToken })}
              nonce={nonce}
            ></script>
          ) : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
