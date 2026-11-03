// End to end (decision 067): the prompt composer keeps every keystroke, a
// passed exercise never offers a link that skips the save, and the lesson's
// one footer key saves the lesson. Signed out, so progress lives in the
// session and runs fall back to the lesson's examples.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

const course = 'tokens-and-temperature'
const temperature = routes.courses.lesson.index.href({ course, lesson: 'temperature' })

async function hydrated(page: { waitForFunction(fn: () => boolean): Promise<unknown> }) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((button) => /^Run/.test(button.textContent?.trim() ?? '') && !button.disabled),
  )
}

// One flat suite: remix test runs after() around every describe.
describe('lesson exercise', () => {
  after(() => disposePlatform())

  it('keeps every keystroke when typing fast', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(temperature)
    await hydrated(page)
    let composer = page.locator('textarea').first()
    await composer.fill('')
    let text = 'Write a short tagline for a coffee shop on the moon, under eight words. '.repeat(3).trim()
    await composer.pressSequentially(text, { delay: 0 })
    assert.equal(await composer.inputValue(), text)
    // Enter adds a line; it never runs the prompt.
    await composer.press('End')
    await composer.press('Enter')
    await composer.pressSequentially('second line', { delay: 0 })
    assert.equal(await composer.inputValue(), `${text}\nsecond line`)
    assert.equal(await page.locator('[data-empty]').count() > 0, true, 'Enter did not run the prompt')
  })

  it('saves the lesson from its one footer key once the exercise passes', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(temperature)
    await hydrated(page)
    let composer = page.locator('textarea').first()
    await composer.fill('Write a short tagline for a coffee shop on the moon, under eight words.')

    for (let label of [/^0\b/, /^1\.0\b/]) {
      await page.getByRole('radio', { name: label }).first().check({ force: true })
      await composer.press('Control+Enter')
      await page.waitForFunction(() => !document.querySelector('form [aria-busy="true"]'))
    }
    await page.getByText('Same prompt, different answers').first().waitFor()

    // The reward celebrates; no link inside the exercise skips the save.
    let exercise = page.locator('form').filter({ has: page.locator('textarea') }).first()
    assert.equal(await exercise.locator('..').locator('a', { hasText: /Next|Back to the course/ }).count(), 0)

    let save = page.getByRole('button', { name: /Complete and continue/ })
    await save.click()
    await page.waitForURL((url) => !url.pathname.endsWith('/temperature'))

    // Back on the lesson, it is saved: the key now just moves on.
    await page.goto(temperature)
    await page.getByRole('link', { name: /^Next: / }).first().waitFor()
  })
})
