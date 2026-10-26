// End to end: the browser runtime's client navigation against the real router
// (test platform: in-memory D1 and R2 with the seeded courses). These cover the
// enhanced path that server tests can't see: island state across lessons (F1)
// and pending UI after a 422 re-render (F2).
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

const course = 'tokens-and-temperature'
const temperature = routes.courses.lesson.index.href({ course, lesson: 'temperature' })
const firstLesson = routes.courses.lesson.index.href({ course, lesson: 'what-is-a-token' })

// One flat suite: remix test runs after() around every describe.
describe('client navigation', () => {
  after(() => disposePlatform())

  it('starts every lesson fresh when navigating lesson to lesson', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(temperature)
    let hint = page.getByText('Pass every check to finish')
    await hint.waitFor()

    // Pass the checks the way the composer does: fire `bits:reward` (repeat
    // until the island has hydrated and is listening).
    await page.waitForFunction(() => {
      window.dispatchEvent(new CustomEvent('bits:reward', { detail: { xp: 0, message: 'test' } }))
      return !document.body.textContent?.includes('Pass every check to finish')
    })
    await page.getByRole('button', { name: /Next: Top-p and friends/ }).waitFor()

    // A marker on window survives only client navigation, not a document load.
    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
    await page.locator(`nav[aria-label="Lessons"] a[href="${firstLesson}"]`).first().click()
    await page.getByRole('heading', { level: 1, name: 'What is a token?' }).waitFor()
    await page.locator(`nav[aria-label="Lessons"] a[href="${temperature}"]`).first().click()
    await page.getByRole('heading', { level: 1, name: 'Temperature & randomness' }).waitFor()

    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')
    await hint.waitFor()
    let complete = page.getByRole('button', { name: 'Complete lesson' })
    assert.equal(await complete.isDisabled(), true, 'the gated key is locked again')
  })

  it('resets the pending submit key after a 422 re-render', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.login.index.href())
    await page.getByLabel('Email').fill('e2e-pending@example.com')
    await page.getByRole('button', { name: /Email me a sign-in link/ }).click()
    await page.getByRole('button', { name: 'Verify & continue' }).waitFor()

    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
    // The hydrated code input is six boxes; it submits itself once they are full.
    await page.getByLabel('Digit 1').fill('000000')
    await page.getByText('That code isn’t right').first().waitFor()

    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')
    let key = page.getByRole('button', { name: 'Verify & continue' })
    await key.waitFor()
    assert.equal(await key.getAttribute('aria-busy'), null, 'no longer busy')
    assert.equal(await page.getByLabel('Digit 1').evaluate((input) => (input as HTMLInputElement).readOnly), false)
  })
})
