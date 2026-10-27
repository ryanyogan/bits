import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { listCourseFolders } from '../../../scripts/lib/content-folder.ts'
import { routes } from '../../routes.ts'
import { fetchAs } from '../../test/auth.ts'
import { ogCards } from '../../ui/og-cards.generated.ts'
import { cardNames, cardPath } from '../../ui/og.ts'

async function page(path: string) {
  let response = await fetchAs(null, path)
  return { status: response.status, headers: response.headers, html: await response.text() }
}

function meta(html: string, key: string): string | undefined {
  return html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1]
}

// One flat suite: remix test runs after() around every describe.
describe('terms, privacy and link previews (decision 028)', () => {
  after(() => disposePlatform())

  it('renders /terms and /privacy as plain pages that link to each other', async () => {
    for (let [href, title] of [
      [routes.legal.terms.href(), 'Terms'],
      [routes.legal.privacy.href(), 'Privacy'],
    ] as const) {
      let { status, html } = await page(href)
      assert.equal(status, 200, href)
      assert.match(html, new RegExp(`<title>${title} · Bits</title>`))
      assert.match(html, new RegExp(`<h1 id="legal-title"[^>]*>${title}</h1>`))
      assert.match(html, /Last updated/)
      assert.match(html, new RegExp(`href="${routes.legal.terms.href()}"`))
      assert.match(html, new RegExp(`href="${routes.legal.privacy.href()}"`))
    }
  })

  it('privacy names what the app actually does', async () => {
    let { html } = await page(routes.legal.privacy.href())
    for (let fact of [/__Host-session/, /Anthropic/, /AI Gateway/, /after 7 days/, /30 days/, /Download my data/]) {
      assert.match(html, fact)
    }
  })

  it('links the policies from the landing footer and the sign-in page', async () => {
    for (let href of [routes.home.href(), routes.login.index.href()]) {
      let { html } = await page(href)
      assert.match(html, new RegExp(`href="${routes.legal.terms.href()}"`), href)
      assert.match(html, new RegExp(`href="${routes.legal.privacy.href()}"`), href)
    }
  })

  it('has a committed card for the landing page and every course folder', async () => {
    let slugs = (await listCourseFolders()).map((dir) => path.basename(dir))
    for (let name of cardNames(slugs)) {
      assert.ok(ogCards[name], `${name} is in og-cards.generated.ts (run pnpm og)`)
      assert.ok(fs.existsSync(path.join(import.meta.dirname, '../../../public', cardPath(name))), `${cardPath(name)} exists`)
    }
  })

  it('gives the landing, course and lesson pages large preview cards', async () => {
    let cases = [
      [routes.home.href(), /\/og\/home\.png\?v=/],
      [routes.courses.course.index.href({ course: 'tokens-and-temperature' }), /\/og\/course-tokens-and-temperature\.png\?v=/],
      [
        routes.courses.lesson.index.href({ course: 'tokens-and-temperature', lesson: 'temperature' }),
        /\/og\/course-tokens-and-temperature\.png\?v=/,
      ],
      // Pages without a card of their own fall back to the landing card.
      [routes.courses.index.href(), /\/og\/home\.png\?v=/],
    ] as const
    for (let [href, image] of cases) {
      let { html } = await page(href)
      let url = meta(html, 'og:image')
      assert.ok(url, `${href} has og:image`)
      assert.match(url, image, href)
      assert.match(url, /^https?:\/\//, 'absolute')
      assert.equal(meta(html, 'og:image:width'), '1200')
      assert.equal(meta(html, 'og:image:height'), '630')
      assert.ok(meta(html, 'og:image:alt'), 'alt text')
      assert.equal(meta(html, 'twitter:card'), 'summary_large_image')
      assert.equal(html.match(/name="twitter:card"/g)?.length, 1, 'one twitter:card')
    }
  })

  it('renders the card pages the screenshots come from (noindex), and 404s unknown ones', async () => {
    for (let card of ['home', 'course-what-is-an-llm', 'certificate-what-is-an-llm']) {
      let { status, headers, html } = await page(routes.cards.show.href({ card }))
      assert.equal(status, 200, card)
      assert.equal(headers.get('X-Robots-Tag'), 'noindex')
      assert.match(html, /data-og-card/)
    }
    assert.equal((await page(routes.cards.show.href({ card: 'course-nope' }))).status, 404)
    assert.equal((await page(routes.cards.show.href({ card: 'whatever' }))).status, 404)
  })
})
