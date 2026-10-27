// End to end: the landing field's pause control (WCAG 2.2.2, decision 034).
// The scene writes a coarse loop counter to the canvas (`data-frames`, every
// 30 frames): it climbs while the loop runs and holds still once paused.
// The choice is stored per viewer and applied before the first frame.
import type { Page } from 'playwright'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

const frames = (page: Page) =>
  page.locator('canvas[data-field]').evaluate((canvas) => Number(canvas.getAttribute('data-frames') ?? 0))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Resolves once the counter moves past `from`, or fails after `timeout`. */
async function framesAdvance(page: Page, from: number, timeout = 8_000) {
  await page.waitForFunction(
    (from) => Number(document.querySelector('canvas[data-field]')?.getAttribute('data-frames') ?? 0) > from,
    from,
    { timeout },
  )
}

// One flat suite: remix test runs after() around every describe.
describe('landing field pause control', () => {
  after(() => disposePlatform())

  it('pauses the render loop, and the choice survives a reload', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(routes.home.href())

    // Hidden until the field is live; then it shows, not pressed, and the loop runs.
    let toggle = page.getByRole('button', { name: 'Pause animation' })
    await toggle.waitFor({ timeout: 15_000 })
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    await framesAdvance(page, 0)

    // Keyboard: focus and press Space.
    await toggle.focus()
    await page.keyboard.press('Space')
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    await page.locator('canvas[data-paused="true"]').waitFor()
    let paused = await frames(page)
    await wait(1_500)
    assert.equal(await frames(page), paused, 'no frames while paused')

    // Reload: paused from the first frame, the loop never starts.
    await page.reload()
    await toggle.waitFor({ timeout: 15_000 })
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    await wait(1_500)
    assert.equal(await frames(page), 0, 'no loop frames after a paused reload')

    // Play again.
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
    await framesAdvance(page, 0)
  })

  it('starts paused under reduced motion, with no stored choice', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(routes.home.href())

    let toggle = page.getByRole('button', { name: 'Pause animation' })
    await toggle.waitFor({ timeout: 15_000 })
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    await wait(1_500)
    assert.equal(await frames(page), 0, 'no loop frames under reduced motion')

    // The viewer can still choose motion; that choice then wins.
    await toggle.click()
    await framesAdvance(page, 0)
    await page.reload()
    await toggle.waitFor({ timeout: 15_000 })
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
  })
})
