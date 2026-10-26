// Files the app's asset layer must publish for the design system to render.
// Consumed at dev/build time in Node (apps/web/app/platform/asset-plan.ts);
// the Worker only ever sees the resolved URLs in the build manifest.
import { fileURLToPath } from 'node:url'

function file(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url))
}

/** Global stylesheets in cascade order. Link every one, in this order, from the document head. */
export const stylesheetFiles: readonly string[] = [
  file('./styles/tokens.css'),
  file('./styles/fonts.css'),
  file('./styles/base.css'),
]

/** Latin faces used above the fold on most pages; preload these. */
export const criticalFontFiles: readonly string[] = [
  file('./fonts/geist-latin-400-normal.woff2'),
  file('./fonts/unbounded-latin-700-normal.woff2'),
]

/** Root of the browser-reachable package source, for the asset server's allow list. */
export const sourceDir: string = file('./')
