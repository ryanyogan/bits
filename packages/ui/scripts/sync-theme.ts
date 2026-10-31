// Copies the light theme's source block into its system-scheme twin
// (decision 062). CSS cannot share one declaration block between a plain
// selector and one inside a media query, so `theme-light.css` holds the
// block twice: `:root[data-theme="light"]` (edited by hand) and
// `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) }`
// (written here). `theme.test.ts` fails when they differ.
//
// Run with `pnpm --filter @bits/ui theme:sync` after editing the first block.
import * as fs from 'node:fs'
import * as path from 'node:path'

import { lightThemeBlocks, systemBlock } from '../src/styles/theme-light.ts'

const file = path.resolve(import.meta.dirname, '../src/styles/theme-light.css')
const css = fs.readFileSync(file, 'utf8')
const { source } = lightThemeBlocks(css)
const next = css.replace(/\/\* theme-light:system[^\n]*\n[\s\S]*?\n {2}\}\n\}\n/, systemBlock(source) + '}\n')
if (next === css) {
  console.log('theme-light.css: already in sync')
} else {
  fs.writeFileSync(file, next)
  console.log('theme-light.css: system block regenerated')
}
