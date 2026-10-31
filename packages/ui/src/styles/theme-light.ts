// Reads the two blocks of theme-light.css (decision 062), for the sync
// script and the drift test. Pure string work: no DOM, no Node.

export interface ThemeBlocks {
  /** The hand-edited `:root[data-theme="light"]` declarations, one per line. */
  source: string[]
  /** The generated `:root:not([data-theme="dark"])` declarations under the media query. */
  system: string[]
}

const SOURCE = /\/\* theme-light:begin[^\n]*\n\s*:root\[data-theme="light"\] \{\n([\s\S]*?)\n\s*\}\n\s*\/\* theme-light:end \*\//
const SYSTEM = /\/\* theme-light:system[^\n]*\n\s*@media \(prefers-color-scheme: light\) \{\n\s*:root:not\(\[data-theme="dark"\]\) \{\n([\s\S]*?)\n\s*\}\n\s*\}/

/** The declarations of a block body, comments dropped, trimmed, blank lines removed. */
export function declarations(body: string): string[] {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function lightThemeBlocks(css: string): ThemeBlocks {
  let source = SOURCE.exec(css)
  let system = SYSTEM.exec(css)
  if (!source) throw new Error('theme-light.css: the source block (theme-light:begin … theme-light:end) was not found')
  if (!system) throw new Error('theme-light.css: the system block (theme-light:system) was not found')
  return { source: declarations(source[1]!), system: declarations(system[1]!) }
}

/** The system-scheme twin of the source declarations, as CSS text (indented for the `@layer` block). */
export function systemBlock(source: string[]): string {
  let lines = source.map((line) => `      ${line}`).join('\n')
  return `  /* theme-light:system (generated from the block above; do not edit) */\n  @media (prefers-color-scheme: light) {\n    :root:not([data-theme="dark"]) {\n${lines}\n    }\n  }\n`
}

/** Custom property names declared in a list of declarations. */
export function propertyNames(lines: string[]): string[] {
  return lines.map((line) => /^(--[a-z0-9-]+)\s*:/.exec(line)?.[1]).filter((name): name is string => !!name)
}

/** The colour-valued custom properties of a stylesheet (hex or rgb literals; aliases to other tokens don't count). */
export function colourTokens(css: string): string[] {
  let names = new Set<string>()
  for (let match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\()/g)) {
    names.add(match[1]!)
  }
  return [...names]
}
