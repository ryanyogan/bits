// End to end: the strict, nonce-based Content-Security-Policy (decision 027)
// against the real router. Every response has a fresh nonce, but client
// navigation keeps the first document (and its policy), so this walks pages
// on the client and checks that islands first needed on a later page still
// load and run, and that the browser reported no violation on the way.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

type Violation = { directive: string; blocked: string; sample: string }

/** Records every `securitypolicyviolation` in the page (Playwright init scripts aren't subject to the policy). */
function recordViolations() {
  let list: Violation[] = []
  ;(window as unknown as { cspViolations: Violation[] }).cspViolations = list
  document.addEventListener('securitypolicyviolation', (event) => {
    list.push({ directive: event.effectiveDirective, blocked: event.blockedURI, sample: event.sample })
  })
}

// One flat suite: remix test runs after() around every describe.
describe('content security policy', () => {
  after(() => disposePlatform())

  it('runs every page and island under the policy across client navigation', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.addInitScript(recordViolations)
    let consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) consoleErrors.push(message.text())
    })

    await page.goto(routes.courses.course.index.href({ course: 'what-is-an-llm' }))
    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))

    // A lesson whose training scrubber is first needed after a client navigation.
    let pretraining = routes.courses.lesson.index.href({ course: 'what-is-an-llm', lesson: 'where-it-learned-pretraining' })
    await page.locator(`a[href="${pretraining}"]`).first().click()
    await page.getByRole('heading', { level: 1, name: 'Where it learned: pretraining' }).waitFor()
    let slider = page.getByRole('slider', { name: 'training step' })
    await slider.waitFor()
    let before = await slider.getAttribute('aria-valuetext')
    // Hydrated means the input handler runs; retry until the island is live.
    await page.waitForFunction(
      (initial) => {
        let input = document.querySelector<HTMLInputElement>('input[type="range"]')
        if (!input) return false
        input.value = input.max
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return input.getAttribute('aria-valuetext') !== initial
      },
      before,
      { timeout: 10_000 },
    )
    assert.notEqual(await slider.getAttribute('aria-valuetext'), before, 'the scrubber island hydrated after client navigation')

    // On to the attention map and the sign-in page, still on the client.
    let attention = routes.courses.lesson.index.href({ course: 'what-is-an-llm', lesson: 'attention-how-it-keeps-track' })
    await page.locator(`nav[aria-label="Lessons"] a[href="${attention}"]`).first().click()
    await page.getByRole('heading', { level: 1, name: 'Attention: how it keeps track' }).waitFor()
    await page.getByRole('toolbar', { name: /Tokens: pick one/ }).waitFor()
    await page.goto(routes.login.index.href())
    await page.getByLabel('Email').waitFor()

    assert.equal(await page.evaluate(() => typeof (window as { navMarker?: number }).navMarker), 'undefined', 'the last goto was a document load')
    let violations = await page.evaluate(() => (window as unknown as { cspViolations: Violation[] }).cspViolations)
    assert.deepEqual(violations, [])
    assert.deepEqual(consoleErrors, [])
  })

  it('stays on the client and blocks injected inline script', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.addInitScript(recordViolations)
    await page.goto(routes.home.href())
    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
    await page.locator(`a[href="${routes.courses.index.href()}"]`).first().click()
    await page.getByRole('searchbox', { name: 'Search courses' }).waitFor()
    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')
    assert.deepEqual(await page.evaluate(() => (window as unknown as { cspViolations: Violation[] }).cspViolations), [])

    // Markup injection can't run script: no inline handlers, no nonce-less <script>.
    await page.evaluate(() => {
      let box = document.createElement('div')
      box.innerHTML = '<img src="data:," onerror="window.pwned = 1">'
      document.body.append(box)
    })
    await page.waitForFunction(() => (window as unknown as { cspViolations: Violation[] }).cspViolations.length > 0)
    assert.equal(await page.evaluate(() => (window as { pwned?: number }).pwned), undefined)
    let [violation] = await page.evaluate(() => (window as unknown as { cspViolations: Violation[] }).cspViolations)
    assert.match(violation.directive, /^script-src/)
  })
})
