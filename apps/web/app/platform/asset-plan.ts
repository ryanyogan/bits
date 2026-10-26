// What the browser needs from the server, described once for both runtimes:
// the Node dev server resolves it on demand, and scripts/build.ts resolves it
// ahead of time into the Workers static-asset manifest.
import * as path from 'node:path'

import { criticalFontFiles, sourceDir as uiSourceDir, stylesheetFiles } from '@bits/ui/assets'

/** Monorepo root. The asset server is rooted here so workspace packages are reachable. */
export const repoRoot = path.resolve(import.meta.dirname, '../../../..')
/** apps/web */
export const appDir = path.resolve(import.meta.dirname, '../..')

function rel(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join('/')
}

/** Browser runtime entry that boots hydration. */
export const entryFile = rel(path.join(appDir, 'app/actions/public/entry.ts'))
export const stylesheets = stylesheetFiles.map(rel)
export const fontPreloads = criticalFontFiles.map(rel)

/** Asset server access policy: the security boundary for what the browser may fetch. */
export const assetAccess = {
  basePath: '/assets',
  rootDir: repoRoot,
  mounts: {
    app: rel(path.join(appDir, 'app')),
    ui: rel(uiSourceDir),
    npm: 'node_modules',
  },
  allowFiles: [
    rel(path.join(appDir, 'app/routes.ts')),
    `${rel(path.join(appDir, 'app'))}/**/public/**`,
    `${rel(uiSourceDir)}/**`,
  ],
  // @remix-run/ui: headless primitives used by @bits/ui islands (decision 010).
  allowPackages: ['remix', '@remix-run/ui'],
  denyFiles: ['**/*.test.*', `${rel(uiSourceDir)}/assets.ts`],
  files: { extensions: ['.woff2', '.svg', '.png', '.webp'] },
}
