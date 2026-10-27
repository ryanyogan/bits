// End to end: the browser runtime's client navigation against the real router
// (test platform: in-memory D1 and R2 with the seeded courses). These cover the
// enhanced path that server tests can't see: island state across lessons (F1),
// pending UI after a 422 re-render (F2), and the app-wide navigation feedback
// (pending forms, double-submit guard, progress bar; decision 024).
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { outbox } from './auth/mailer.ts'

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
    // The wrong code puts the cursor back in the first box, described by the error.
    assert.equal(
      await page.evaluate(() => document.activeElement?.closest('label')?.textContent),
      'Digit 1',
      'focus returns to the first box',
    )
    assert.equal(
      await page.getByLabel('Digit 1').evaluate((input) => document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent),
      'That code isn’t right. Check the newest email and try again.',
    )
  })

  it('sends one request when the submit key is pressed twice', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let email = `e2e-double-${Date.now()}@example.com`
    await page.goto(routes.login.index.href())
    await page.getByLabel('Email').fill(email)
    // A slow network: the first POST is still in flight when the second click lands.
    let posts = 0
    await page.route('**/login', async (route) => {
      if (route.request().method() === 'POST') {
        posts++
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      await route.continue().catch(() => {})
    })
    // Not by name: the label turns into "Sending…" after the first click.
    let key = page.locator('form[method="post"] button[type="submit"]')
    await key.click()
    await key.click()
    await page.getByRole('button', { name: 'Verify & continue' }).waitFor()
    assert.equal(posts, 1, 'the second submit was dropped')
    assert.equal(outbox.filter((m) => m.to === email).length, 1)
  })

  it('marks the submitter busy and shows the progress bar during a slow navigation', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.login.index.href())
    await page.getByLabel('Email').fill('not-an-email')
    // Hold the POST so the pending state is observable.
    let release!: () => void
    let held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/login', async (route) => {
      if (route.request().method() === 'POST') await held
      await route.continue()
    })
    let key = page.getByRole('button', { name: /Email me a sign-in link/ })
    await key.click()
    await page.locator('bits-progress[role="progressbar"]').waitFor({ state: 'attached' })
    assert.equal(await page.locator('form[data-pending] button[aria-busy="true"]').count(), 1)
    release()
    await page.getByText('Check the highlighted field.').waitFor()
    await page.locator('bits-progress').waitFor({ state: 'detached' })
    assert.equal(await page.locator('[aria-busy="true"], form[data-pending]').count(), 0, 'pending cleared')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'auth-email', 'focus on the invalid field')
  })

  it('keeps focus on the quiz Check key and announces the explanation', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(firstLesson)
    let quiz = page.locator('form[data-rmx-reset-focus]:has(fieldset)').first()
    await quiz.locator('label').first().click()
    await quiz.getByRole('button', { name: 'Check' }).click()
    await quiz.getByRole('button', { name: 'Check again' }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Check again')
    assert.notEqual((await quiz.getByRole('status').textContent())?.trim(), '')
  })

  it('keeps focus in the catalog search after Enter', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.courses.index.href())
    let search = page.getByRole('searchbox', { name: 'Search courses' })
    await search.fill('token')
    await search.press('Enter')
    await page.waitForURL(/\?q=token/)
    await page.getByText(/courses? · all free/).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'course-search')
  })
})
