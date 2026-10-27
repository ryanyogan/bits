// End to end (milestone 5, decision 029): switching lesson modes on the
// client keeps the exercise draft and the video position. Signed out, so
// both live in localStorage; the server copy is covered by
// app/actions/api/drafts.test.ts.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

const course = 'tokens-and-temperature'
const temperature = routes.courses.lesson.index.href({ course, lesson: 'temperature' })
const modeHref = (mode: string) => routes.courses.lesson.index.href({ course, lesson: 'temperature' }, { searchParams: { mode } })

// One flat suite: remix test runs after() around every describe.
describe('drafts across modes', () => {
  after(() => disposePlatform())

  it('keeps the draft and the video position when switching modes', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(temperature)
    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))

    // Read mode: type into the composer (wait for hydration: it enables Run).
    let composer = page.locator('textarea').first()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some((button) => /^Run/.test(button.textContent?.trim() ?? '') && !button.disabled),
    )
    await composer.fill('Moon café, brewed in low gravity')

    // Terminal mode has the same draft.
    await page.locator(`a[href="${modeHref('terminal')}"]`).first().click()
    let input = page.locator('input[aria-keyshortcuts="Enter"]')
    await page.waitForFunction(
      () => (document.querySelector('input[aria-keyshortcuts="Enter"]') as HTMLInputElement | null)?.value.includes('low gravity'),
    )
    assert.equal(await input.inputValue(), 'Moon café, brewed in low gravity')

    // Watch mode: seek to 1:40.
    await page.locator(`a[href="${modeHref('watch')}"]`).first().click()
    let seek = page.getByRole('slider', { name: 'Seek' })
    await seek.waitFor()
    await page.waitForFunction(() => document.querySelector('video') !== null)
    await seek.fill('100')
    await page.getByText('1:40 / 4:30').waitFor()

    // Back to Read, then Watch again: the position is still there.
    await page.locator(`a[href="${temperature}"]`).first().click()
    await composer.waitFor()
    assert.equal(await composer.inputValue(), 'Moon café, brewed in low gravity')
    await page.locator(`a[href="${modeHref('watch')}"]`).first().click()
    await page.getByText('1:40 / 4:30').waitFor()

    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')
  })
})
