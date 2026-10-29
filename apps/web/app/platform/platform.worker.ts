// Cloudflare Workers runtime. Selected by the `workerd` condition of the
// `#platform` import in package.json; bundled by scripts/build.ts.
import { env, waitUntil } from 'cloudflare:workers'
import type { Middleware } from 'remix/router'

import { unpackManifest, type PackedManifest } from './packed-manifest.ts'
import type { AppAssets, Platform, SharedCache } from './types.ts'

/** Injected by scripts/build.ts (esbuild `define`) from the asset build, packed. */
declare const __BITS_ASSET_MANIFEST__: PackedManifest

const manifest = unpackManifest(__BITS_ASSET_MANIFEST__)

const assets: AppAssets = {
  entry: manifest.entry,
  stylesheets: manifest.stylesheets,
  fontPreloads: manifest.fontPreloads,
  fonts: manifest.fonts,
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

// The Workers Cache API (decision 054): per data centre, shared by every
// isolate there, and a no-op on workers.dev (Previews). Keys are synthetic
// GET URLs on the canonical origin, which nothing else serves; `put` needs a
// Cache-Control. Failures are misses: the caller falls back to R2.
const cacheOrigin = env.CANONICAL_ORIGIN || 'https://bits.internal'
const cacheUrl = (key: string) => `${cacheOrigin}/_cache/${key}`
type WorkersCache = { match(url: string): Promise<Response | undefined>; put(url: string, response: Response): Promise<void>; delete(url: string): Promise<boolean> }
const colo = () => (globalThis as unknown as { caches: { default: WorkersCache } }).caches.default

const sharedCache: SharedCache = {
  async get(key) {
    try {
      let response = await colo().match(cacheUrl(key))
      return response ? await response.text() : undefined
    } catch {
      return undefined
    }
  },
  async put(key, body, maxAgeSeconds) {
    try {
      await colo().put(
        cacheUrl(key),
        new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAgeSeconds}` } }),
      )
    } catch {}
  },
  async delete(key) {
    try {
      await colo().delete(cacheUrl(key))
    } catch {}
  },
}

const passThrough: Middleware = (_context, next) => next()

export const platform: Platform = {
  runtime: 'workerd',
  env,
  assets,
  csp: { reportOnly: false, connectSrc: [] },
  middleware: passThrough,
  waitUntil,
  sharedCache,
}

export async function disposePlatform(): Promise<void> {}
