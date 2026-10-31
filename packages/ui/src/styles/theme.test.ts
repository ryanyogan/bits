import * as fs from 'node:fs'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { colourTokens, lightThemeBlocks, propertyNames } from './theme-light.ts'

const light = fs.readFileSync(new URL('./theme-light.css', import.meta.url), 'utf8')
const dark = fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

describe('light theme (decision 062)', () => {
  it('declares the same tokens, with the same values, under both selectors', () => {
    let { source, system } = lightThemeBlocks(light)
    assert.deepEqual(system, source, 'theme-light.css: the system block differs from the source block; run `pnpm --filter @bits/ui theme:sync`')
  })

  it('gives every colour token of the dark theme a light value, and invents none', () => {
    let { source } = lightThemeBlocks(light)
    let lightNames = propertyNames(source)
    let darkColours = colourTokens(dark)
    let missing = darkColours.filter((name) => !lightNames.includes(name))
    assert.deepEqual(missing, [], 'colour tokens in tokens.css with no light value (a dark colour would leak into the light theme)')
    let darkNames = new Set(propertyNames(dark.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim())))
    let unknown = lightNames.filter((name) => !darkNames.has(name))
    assert.deepEqual(unknown, [], 'light-only tokens (every token must have a dark value in tokens.css)')
    assert.deepEqual(
      lightNames.filter((name, i) => lightNames.indexOf(name) !== i),
      [],
      'a token is declared twice in the light block',
    )
  })

  it('switches the colour scheme with the colours', () => {
    let { source } = lightThemeBlocks(light)
    assert.ok(source.includes('color-scheme: light;'), 'the light block must set color-scheme: light')
    assert.match(dark, /color-scheme: dark;/)
  })
})
