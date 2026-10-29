// End to end: scroll restoration under the browser runtime's client
// navigation (decision 049). The runtime intercepts navigations with the
// Navigation API and its default `"after-transition"` scroll: a push goes to
// the top (or the URL's #fragment), back/forward restores the saved position.
// Forms that re-render in place opt out with `data-rmx-reset-scroll="manual"`.
// These pin that we rely on it rather than fight it.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { disposePlatform } from '#platform'

import { router } from './router.ts'
import { routes } from './routes.ts'

const firstLesson = routes.courses.lesson.index.href({ course: 'tokens-and-temperature', lesson: 'what-is-a-token' })

/** A marker on window survives only client navigation, not a document load. */
async function mark(page: Page) {
  await page.evaluate(() => ((window as { navMarker?: number }).navMarker = 1))
}
async function marked(page: Page) {
  return page.evaluate(() => (window as { navMarker?: number }).navMarker === 1)
}
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))

// One flat suite: remix test runs after() around every describe.
describe('scroll restoration', () => {
  after(() => disposePlatform())

  it('starts a new page at the top and restores the catalog on back', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(routes.courses.index.href())
    await page.waitForLoadState('networkidle')
    await mark(page)

    // Scroll the catalog's last course card to the bottom of the screen.
    let card = page.locator('main a[href^="/courses/"]').last()
    let href = await card.getAttribute('href')
    assert.ok(href, 'the catalog lists courses')
    await card.evaluate((node) => node.scrollIntoView({ block: 'end' }))
    let y = await scrollY(page)
    assert.ok(y > 200, `scrolled down the catalog (${y}px)`)
    await card.click()
    await page.waitForURL(`**${href}`)
    await page.getByRole('heading', { level: 1 }).first().waitFor()
    await page.waitForFunction(() => window.scrollY === 0)
    assert.equal(await scrollY(page), 0, 'the course page starts at the top')
    assert.ok(await marked(page), 'navigated on the client')

    await page.goBack()
    await page.waitForURL(`**${routes.courses.index.href()}`)
    await page.waitForFunction((y) => Math.abs(window.scrollY - y) <= 1, y, { timeout: 5000 }).catch(() => {})
    assert.ok(Math.abs((await scrollY(page)) - y) <= 1, `back restores the catalog position (${await scrollY(page)} vs ${y})`)
    assert.ok(await marked(page), 'back stayed on the client')
  })

  it('lands a same-page hash link on its target, below the sticky bar', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(routes.home.href())
    await page.waitForLoadState('networkidle')
    await page.locator('a[href="#how"]').first().click()
    await page.waitForURL('**/#how')
    await page.waitForFunction(() => {
      let top = document.getElementById('how')!.getBoundingClientRect().top
      return top >= 0 && top < 200
    })
    let { top, padding } = await page.evaluate(() => ({
      top: document.getElementById('how')!.getBoundingClientRect().top,
      padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
    }))
    assert.ok(Math.abs(top - padding) <= 2, `#how sits at the scroll padding (${top}px vs ${padding}px)`)
  })

  it('lands a hash link from another page on its target', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(routes.courses.index.href())
    await page.waitForLoadState('networkidle')
    await mark(page)
    // Client navigation to /#path, as a link elsewhere in the app would.
    await page.evaluate(() => {
      let a = document.createElement('a')
      a.href = '/#path'
      a.textContent = 'path'
      document.querySelector('main')!.append(a)
      a.click()
    })
    await page.waitForURL('**/#path')
    await page.waitForFunction(() => {
      let el = document.getElementById('path')
      if (!el) return false
      let top = el.getBoundingClientRect().top
      return top >= 0 && top < 200
    })
    assert.ok(await marked(page), 'navigated on the client')
  })

  it('keeps the quiz where it is when a check re-renders it', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(firstLesson)
    await page.waitForLoadState('networkidle')
    let quiz = page.locator('form[data-rmx-reset-focus]:has(fieldset)').first()
    await quiz.evaluate((form) => form.scrollIntoView({ block: 'center' }))
    let before = await quiz.evaluate((form) => form.getBoundingClientRect().top)
    let y = await scrollY(page)
    assert.ok(y > 0, 'the quiz is below the fold')

    await quiz.locator('label').first().click()
    await quiz.getByRole('button', { name: 'Check' }).click()
    await quiz.getByRole('button', { name: 'Check again' }).waitFor()
    let afterTop = await quiz.evaluate((form) => form.getBoundingClientRect().top)
    assert.ok(Math.abs(afterTop - before) <= 1, `the quiz stays put (moved ${afterTop - before}px)`)
    assert.ok(Math.abs((await scrollY(page)) - y) <= 1, 'no jump to the top or the anchor')
  })

  it('keeps the catalog where it is when a search re-renders it', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(routes.courses.index.href())
    await page.waitForLoadState('networkidle')
    let search = page.getByRole('searchbox', { name: 'Search courses' })
    await search.evaluate((input) => input.scrollIntoView({ block: 'start' }))
    let y = await scrollY(page)
    assert.ok(y > 0, 'scrolled down to the search row')

    await search.fill('token')
    await search.press('Enter')
    await page.waitForURL(/\?q=token/)
    await page.getByText(/courses? · all free/).waitFor()
    // Fewer results can make the page shorter than the old position: then
    // the browser clamps to the new bottom, but it never jumps to the top.
    let { now, max } = await page.evaluate(() => ({
      now: Math.round(window.scrollY),
      max: document.documentElement.scrollHeight - window.innerHeight,
    }))
    assert.ok(Math.abs(now - Math.min(y, max)) <= 1, `the search row stays put (${now} vs ${y}, bottom ${max})`)
    assert.ok(now > 0, 'no jump to the top')
  })

  it('keeps the catalog where it is when a track filter re-renders it', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(routes.courses.index.href())
    await page.waitForLoadState('networkidle')
    let filters = page.getByRole('navigation', { name: 'Filter by track' })
    await filters.evaluate((nav) => nav.scrollIntoView({ block: 'start' }))
    let y = await scrollY(page)
    assert.ok(y > 0, 'scrolled down to the filters')
    let pill = filters.locator('a:not([aria-current])').first()
    let href = await pill.getAttribute('href')
    await pill.click()
    await page.waitForURL(`**${href}`)
    await filters.locator(`a[href="${href}"][aria-current]`).waitFor()
    let { now, max } = await page.evaluate(() => ({
      now: Math.round(window.scrollY),
      max: document.documentElement.scrollHeight - window.innerHeight,
    }))
    assert.ok(Math.abs(now - Math.min(y, max)) <= 1, `the filters stay put (${now} vs ${y}, bottom ${max})`)
    assert.ok(now > 0, 'no jump to the top')
  })

  it('reserves the scrollbar gutter on every page (no sideways jump)', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    // Playwright hides headless scrollbars, but Chromium still reserves a
    // stable gutter's width, so the frame's rails can be compared: a short
    // page (sign-in, a 404) and long ones must put them at the same x.
    // Decision 049 has the measurements with real scrollbars.
    await page.setViewportSize({ width: 1440, height: 1400 })
    let seen = new Set<string>()
    for (let path of [routes.login.index.href(), '/no-such-page', routes.courses.index.href(), routes.home.href()]) {
      await page.goto(path)
      let root = await page.evaluate(() => {
        let html = document.documentElement
        let style = getComputedStyle(html)
        // The widest railed block: a section plate, or a frame with rails
        // (decision 050). Anything inside a plate is narrower than it.
        let frame = [...document.querySelectorAll('body *')]
          .filter((el) => {
            let s = getComputedStyle(el)
            let r = el.getBoundingClientRect()
            return s.borderLeftStyle === 'solid' && s.borderRightStyle === 'solid' && r.width > innerWidth / 2 && r.height > 100
          })
          .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
        let rect = frame?.getBoundingClientRect()
        return {
          gutter: style.scrollbarGutter,
          overflowX: style.overflowX,
          long: html.scrollHeight > innerHeight,
          rails: rect ? `${rect.left}/${rect.right} in ${document.body.clientWidth}` : 'none',
        }
      })
      assert.equal(root.gutter, 'stable', `${path}: html reserves the gutter`)
      assert.equal(root.overflowX, 'clip', `${path}: html clips sideways overflow`)
      assert.notEqual(root.rails, 'none', `${path}: has a PageFrame`)
      seen.add(`${root.long}`)
      seen.add(root.rails)
    }
    assert.ok(seen.has('true') && seen.has('false'), 'measured short and long pages')
    seen.delete('true')
    seen.delete('false')
    assert.equal(seen.size, 1, `the rails sit at one x on every page: ${[...seen].join(', ')}`)
  })
})
