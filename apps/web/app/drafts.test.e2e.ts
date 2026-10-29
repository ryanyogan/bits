// End to end (milestone 5, decisions 029 and 055): leaving a lesson on the
// client and coming back keeps the exercise draft and the video position. Signed out, so
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
const nextLesson = routes.courses.lesson.index.href({ course, lesson: 'top-p-and-friends' })

// One flat suite: remix test runs after() around every describe.
describe('drafts across lessons', () => {
  after(() => disposePlatform())

  it('keeps the draft and the video position when leaving the lesson and coming back', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(temperature)
    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))

    // Type into the composer (wait for hydration: it enables Run).
    let composer = page.locator('textarea').first()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some((button) => /^Run/.test(button.textContent?.trim() ?? '') && !button.disabled),
    )
    await composer.fill('Moon café, brewed in low gravity')

    // The video at the top of the lesson (decision 055): seek to 1:40.
    let seek = page.getByRole('slider', { name: 'Seek' })
    await seek.waitFor()
    await page.waitForFunction(() => document.querySelector('video') !== null)
    await seek.fill('100')
    await page.getByText('1:40 / 4:30').waitFor()

    // Another lesson replaces the lesson's islands; coming back restores both.
    let outline = page.getByRole('navigation', { name: 'Lessons' }).first()
    await outline.locator(`a[href="${nextLesson}"]`).click()
    await page.waitForURL(`**${nextLesson}`)
    await outline.locator(`a[href="${temperature}"]`).click()
    await page.waitForURL(`**${temperature}`)
    await page.getByText('1:40 / 4:30').waitFor()
    await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('low gravity'))
    assert.equal(await composer.inputValue(), 'Moon café, brewed in low gravity')

    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')
  })
})
