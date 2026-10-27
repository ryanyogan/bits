// End to end: the badge toast (decision 028) through client navigation.
// Completing a lesson POSTs the native form; the browser runtime follows the
// 303 and reconciles the next lesson into the page. The badge the server
// just awarded comes back as a session flash and shows in the reward region.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'
import { requestCode } from './test/auth.ts'

const course = 'context-is-everything'

// One flat suite: remix test runs after() around every describe.
describe('badge toast', () => {
  after(() => disposePlatform())

  it('shows a badge earned by completing a lesson, after a client navigation, then dismisses it', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    // Sign in through the emailed magic link.
    let { token } = await requestCode(`e2e-badge-${Date.now()}@example.com`)
    await page.goto(routes.auth.verify.index.href(undefined, { searchParams: { token } }))
    await page.getByRole('button', { name: 'Continue to Bits →' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'))

    await page.goto(routes.courses.lesson.index.href({ course, lesson: 'lesson-1' }))
    await page.getByRole('heading', { level: 1, name: 'Lesson 1' }).waitFor()

    await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
    await page.locator('form#lesson-complete button[type="submit"]').click()
    await page.getByRole('heading', { level: 1, name: 'Lesson 2' }).waitFor()
    assert.equal(await page.evaluate(() => (window as { navMarker?: number }).navMarker), 1, 'navigated on the client')

    let toast = page.getByRole('status').filter({ hasText: 'Badge earned: First token' })
    await toast.waitFor()
    assert.equal(await toast.getByRole('link', { name: 'See your badges →' }).getAttribute('href'), routes.me.index.href())

    // Hydrated, it goes away on its own (8s).
    await page.getByText('Badge earned: First token').waitFor({ state: 'detached', timeout: 15_000 })
  })
})
