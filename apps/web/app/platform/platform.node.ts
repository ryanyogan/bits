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

// Tests start from an empty in-memory D1 and R2: give them the real schema
// and publish every course in content/courses/ through the real pipeline.
if (isTest) {
  let { applyMigrations } = await import('@bits/db/test/migrations')
  await applyMigrations(proxy.env.DB)
  let { createD1Database } = await import('@bits/db')
  let { listCourseFolders } = await import('../../scripts/lib/content-folder.ts')
  let { uploadCourseFolder } = await import('../../scripts/lib/upload.ts')
  let db = createD1Database(proxy.env.DB)
  // A ready upload for the Temperature lesson's video, so builds link it (decision 029).
  let { seedTestVideo } = await import('../test/videos.ts')
  await seedTestVideo(db, proxy.env.CONTENT)
  for (let dir of await listCourseFolders()) {
    let result = await uploadCourseFolder(db, proxy.env.CONTENT, dir, { source: 'test', publish: true })
    if (!result.published) throw new Error(`content/courses/${result.build.slug} didn't build: ${JSON.stringify(result.build.report)}`)
  }
}

export const platform: Platform = {
  runtime: 'node',
  env: Object.assign(
    Object.create(proxy.env) as Env,
    { APP_ENV: nodeEnv },
    // Tests never reach a real provider, whatever .dev.vars holds: live-run
    // tests set these themselves and stub the gateway (app/runs/run.test.ts).
    // Nor do they share burst limits: every request in a test run comes from
    // one address, so the limiters are off (app/middleware/rate-limit.test.ts
    // installs its own).
    isTest
      ? { ANTHROPIC_API_KEY: undefined, CF_AIG_TOKEN: undefined, RL_WRITES: undefined, RL_SIGNIN: undefined, RL_RUNS: undefined, RL_REPORTS: undefined, RL_DRAFTS: undefined, RL_UPLOADS: undefined }
      : {},
  ),
  assets,
  // `pnpm dev` (HMR): the HMR client appends import maps without a nonce and
  // streams events from another port, so the policy only reports there.
  // `pnpm dev:restart`, `pnpm start` and tests enforce it like the Worker.
  csp: isHmr ? { reportOnly: true, connectSrc: ['http://localhost:*', 'http://127.0.0.1:*'] } : { reportOnly: false, connectSrc: [] },
  middleware: staticFiles(path.join(appDir, 'public'), { index: false }),
  waitUntil(promise) {
    promise.catch((error: unknown) => console.error(error))
  },
}

/** Releases the asset watcher and the local workerd behind the bindings. */
export async function disposePlatform(): Promise<void> {
  await Promise.allSettled([assetServer.close(), proxy.dispose()])
}
