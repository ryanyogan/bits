// Node runtime (development, tests, `pnpm start`). Selected by the default
// condition of the `#platform` import in package.json.
import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'
import { componentHmr } from 'remix/component-hmr/assets'
import { staticFiles } from 'remix/middleware/static'
import { getPlatformProxy } from 'wrangler'

import { appDir, assetAccess, entryFile, fontFiles, fontPreloads, stylesheets } from './asset-plan.ts'
import type { AppAssets, Platform } from './types.ts'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isTest = nodeEnv === 'test'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

const assetServer = createAssetServer({
  ...assetAccess,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment && !isTest,
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
})

const assets: AppAssets = {
  entry: await assetServer.getScriptEntry(entryFile),
  stylesheets: await Promise.all(stylesheets.map((file) => assetServer.getHref(file))),
  fontPreloads: await Promise.all(fontPreloads.map((file) => assetServer.getHref(file))),
  fonts: Object.fromEntries(
    await Promise.all(
      Object.entries(fontFiles).map(async ([name, file]) => [name, await assetServer.getHref(file)] as const),
    ),
  ),
  getScriptEntry: (entryId) => assetServer.getScriptEntry(entryId),
  fetch: (request) => assetServer.fetch(request),
}

// Bindings from wrangler.jsonc, backed by the same local state as
// `wrangler dev` and `wrangler d1 ... --local` (apps/web/.wrangler/state).
// Tests get throwaway in-memory bindings instead.
const proxy = await getPlatformProxy<Env>({
  configPath: path.join(appDir, 'wrangler.jsonc'),
  persist: isTest ? false : { path: path.join(appDir, '.wrangler/state/v3') },
})

// Tests start from an empty in-memory D1; give it the real schema.
if (isTest) {
  let { applyMigrations } = await import('@bits/db/test/migrations')
  await applyMigrations(proxy.env.DB)
}

export const platform: Platform = {
  runtime: 'node',
  env: Object.assign(Object.create(proxy.env) as Env, { APP_ENV: nodeEnv }),
  assets,
  middleware: staticFiles(path.join(appDir, 'public'), { index: false }),
}

/** Releases the asset watcher and the local workerd behind the bindings. */
export async function disposePlatform(): Promise<void> {
  await Promise.allSettled([assetServer.close(), proxy.dispose()])
}
