// Cloudflare Workers runtime. Selected by the `workerd` condition of the
// `#platform` import in package.json; bundled by scripts/build.ts.
import { env } from 'cloudflare:workers'
import type { Middleware } from 'remix/router'

import type { AppAssets, AssetManifest, Platform } from './types.ts'

/** Injected by scripts/build.ts (esbuild `define`) from the asset build. */
declare const __BITS_ASSET_MANIFEST__: AssetManifest

const manifest = __BITS_ASSET_MANIFEST__

const assets: AppAssets = {
  entry: manifest.entry,
  stylesheets: manifest.stylesheets,
  fontPreloads: manifest.fontPreloads,
  async getScriptEntry(entryId) {
    // The build rewrites each module's import.meta.url to
    // `file:///<repo-relative path>`, which is the manifest key.
    let key = entryId.replace(/^file:\/\/\//, '')
    let entry = manifest.clientEntries[key]
    if (!entry) throw new Error(`No built client entry for ${entryId}. Rebuild with \`pnpm build\`.`)
    return structuredClone(entry)
  },
  // Built assets are served by Workers Static Assets before the Worker runs,
  // so an /assets/* request that reaches the Worker is a miss.
  async fetch() {
    return null
  },
}

const passThrough: Middleware = (_context, next) => next()

export const platform: Platform = {
  runtime: 'workerd',
  env,
  assets,
  middleware: passThrough,
}

export async function disposePlatform(): Promise<void> {}
