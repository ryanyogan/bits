// End to end: the theme switch through the enhanced runtime (decisions 020,
// 062). `<html>` is outside what a page swap obviously touches, so this
// clicks the real controls and reads the attribute and the painted ground.
import type { Page } from 'playwright'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'
import { requestCode } from './test/auth.ts'

const DARK_GROUND = 'rgb(15, 19, 26)'
const LIGHT_GROUND = 'rgb(245, 246, 248)'

const attribute = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const ground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const metas = (page: Page) =>
  page.evaluate(() =>
    [...document.head.querySelectorAll('meta[name="color-scheme"], meta[name="theme-color"]')].map(
      (meta) => `${meta.getAttribute('name')}=${meta.getAttribute('content')}`,
    ),
  )

/** A marker on window survives client navigation, never a document load. */
const mark = (page: Page) => page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
const marked = (page: Page) => page.evaluate(() => (window as { navMarker?: number }).navMarker)

/** The theme the page settles on: every pending colour transition finished. */
async function settledTheme(page: Page, theme: string | null, background: string) {
  await page.waitForFunction(
    ([expected, color]) =>
      document.documentElement.getAttribute('data-theme') === expected && getComputedStyle(document.body).backgroundColor === color,
    [theme, background] as const,
    { timeout: 5_000 },
  )
}

async function signInBrowser(page: Page, email: string) {
  let { token } = await requestCode(email)
  await page.goto(routes.auth.verify.index.href(undefined, { searchParams: { token } }))
  await page.getByRole('button', { name: 'Continue to Bits →' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

// One flat suite: remix test runs after() around every describe.
describe('the theme switch in the browser', () => {
  after(() => disposePlatform())

  it('the footer switch changes the attribute, the metas and the ground without a manual reload', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto(routes.home.href())
    await page.waitForLoadState('networkidle')
    assert.equal(await attribute(page), null)
    assert.equal(await ground(page), DARK_GROUND)

    await mark(page)
    let theme = page.getByRole('form', { name: 'Theme' })
    await theme.getByRole('button', { name: 'Light' }).click()
    await settledTheme(page, 'light', LIGHT_GROUND)
    assert.deepEqual(await metas(page), ['color-scheme=light', 'theme-color=#F5F6F8'])
    await theme.getByRole('button', { name: 'Light', pressed: true }).waitFor()

    await theme.getByRole('button', { name: 'Dark' }).click()
    await settledTheme(page, 'dark', DARK_GROUND)
    assert.deepEqual(await metas(page), ['color-scheme=dark', 'theme-color=#0F131A'])

    await theme.getByRole('button', { name: 'System' }).click()
    await settledTheme(page, null, DARK_GROUND)
    assert.deepEqual(await metas(page), ['color-scheme=dark light', 'theme-color=#0F131A', 'theme-color=#F5F6F8'])
    assert.equal(await marked(page), 1, 'all three stayed on the enhanced path')
  })

  it('the footer switch works with the keyboard', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto(routes.home.href())
    await page.waitForLoadState('networkidle')
    await page.getByRole('form', { name: 'Theme' }).getByRole('button', { name: 'Light' }).focus()
    await page.keyboard.press('Enter')
    await settledTheme(page, 'light', LIGHT_GROUND)
  })

  it('each footer control is a 44px target', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    for (let name of ['System', 'Dark', 'Light']) {
      let box = await page.getByRole('form', { name: 'Theme' }).getByRole('button', { name }).boundingBox()
      assert.ok(box && box.height >= 44, `${name}: ${box?.height}`)
    }
  })

  it('Settings saves the theme through the enhanced form', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await signInBrowser(page, `theme-e2e-${Date.now()}@example.com`)
    await page.goto(routes.settings.index.href())
    await page.waitForLoadState('networkidle')

    await mark(page)
    await page.locator('label', { hasText: 'Light' }).click()
    await page.getByRole('button', { name: 'Save theme' }).click()
    await settledTheme(page, 'light', LIGHT_GROUND)
    assert.deepEqual(await metas(page), ['color-scheme=light', 'theme-color=#F5F6F8'])

    await page.locator('label', { hasText: 'System' }).click()
    await page.getByRole('button', { name: 'Save theme' }).click()
    await settledTheme(page, null, DARK_GROUND)
    assert.equal(await marked(page), 1, 'both saves stayed on the enhanced path')
  })
})
