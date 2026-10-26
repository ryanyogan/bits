import type { Handle, RemixNode } from 'remix/component'
import { ImportMap, type ImportMapData } from 'remix/component/server'

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
 */
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { assets, title, description, head, children } = handle.props
    let { entry, stylesheets, fontPreloads } = assets

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#07080D" />
          <title>{title}</title>
          {description ? <meta name="description" content={description} /> : null}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <style>{LAYER_ORDER}</style>
          {fontPreloads.map((href) => (
            <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
          ))}
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {head}
          <ImportMap value={entry.importMap} />
          {entry.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={entry.href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
