// End to end: the one-shot decorative scenes (decision 057). The catalog's
// course graph and the sign-in sphere animate on their own, so under WCAG
// 2.2.2 they must stop within five seconds: each marks its canvas
// `data-rest` when its sequence ends and its loop stops. Under reduced
// motion they draw the finished frame straight away.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

// Loading three after load + idle takes a while on a software GPU; the
// sequence itself is under 5 s.
const SCENE_TIMEOUT = 25_000

// One flat suite: remix test runs after() around every describe.
describe('decorative scenes rest within five seconds', () => {
  after(() => disposePlatform())

  it('catalog: the course graph assembles, then rests', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(routes.courses.index.href())
    let canvas = page.locator('canvas[data-catalog-graph]')
    await canvas.and(page.locator('[data-ready]')).waitFor({ timeout: SCENE_TIMEOUT })
    let readyAt = Date.now()
    await canvas.and(page.locator('[data-rest]')).waitFor({ timeout: SCENE_TIMEOUT })
    assert.ok(Date.now() - readyAt < 6_000, 'rests within five seconds of its first frame')
  })

  it('catalog: reduced motion shows the finished graph', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(routes.courses.index.href())
    let canvas = page.locator('canvas[data-catalog-graph]')
    await canvas.and(page.locator('[data-ready]')).waitFor({ timeout: SCENE_TIMEOUT })
    assert.equal(await canvas.getAttribute('data-rest'), '', 'at rest from the first frame')
  })

  it('sign-in: the sphere of bits is written, then rests', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(routes.login.index.href())
    let canvas = page.locator('aside[aria-label="About accounts"] canvas')
    await canvas.and(page.locator('[data-ready]')).waitFor({ timeout: SCENE_TIMEOUT })
    let readyAt = Date.now()
    await canvas.and(page.locator('[data-rest]')).waitFor({ timeout: SCENE_TIMEOUT })
    assert.ok(Date.now() - readyAt < 6_000, 'rests within five seconds of its first frame')
  })
})
