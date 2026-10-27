import type { Handle, RemixNode } from 'remix/component'
import { ImportMap, type ImportMapData } from 'remix/component/server'

import { cspNonce } from './csp-nonce.tsx'

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
  /** Extra `<head>` content for the page (meta, preloads). */
  head?: RemixNode
  children?: RemixNode
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
 */
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { assets, title, description, url, siteName, head, children } = handle.props
    let { entry, stylesheets, fontPreloads } = assets
    let nonce = cspNonce(handle)

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#07080D" />
          <title>{title}</title>
          {description ? <meta name="description" content={description} /> : null}
          {url ? <link rel="canonical" href={url} /> : null}
          {/* Link previews (Open Graph; X reads these too). */}
          <meta property="og:type" content="website" />
          <meta property="og:title" content={title} />
          {description ? <meta property="og:description" content={description} /> : null}
          {url ? <meta property="og:url" content={url} /> : null}
          {siteName ? <meta property="og:site_name" content={siteName} /> : null}
          <meta name="twitter:card" content="summary" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <style>{LAYER_ORDER}</style>
          {fontPreloads.map((href) => (
            <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
          ))}
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {head}
          <ImportMap value={entry.importMap} nonce={nonce} />
          {entry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} nonce={nonce} />
          ))}
          <script type="module" src={entry.href} nonce={nonce}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
