import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../router.ts'
import { routes } from '../routes.ts'

after(() => disposePlatform())

function request(path: string, init?: RequestInit) {
  return router.fetch(new Request(new URL(path, 'http://localhost'), init))
}

function form(fields: Record<string, string>) {
  let body = new FormData()
  for (let [name, value] of Object.entries(fields)) body.set(name, value)
  return { method: 'POST', body }
}

describe('router smoke test', () => {
  it('GET / renders the home page in the document shell', async () => {
    let response = await request(routes.home.href())
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    let html = await response.text()
    assert.match(html, /<html[\s>]/)
    assert.match(html, /<title>bits<\/title>/)
    assert.match(html, /rel="stylesheet"/)
    assert.match(html, /type="importmap"/)
  })

  let pages = [
    routes.courses.index.href(),
    routes.courses.course.index.href({ course: 'tokens-and-temperature' }),
    routes.courses.lesson.index.href({ course: 'prompting-101', lesson: 'what-is-a-token' }),
    routes.login.index.href(),
    routes.login.check.index.href(),
    routes.me.index.href(),
    routes.profile.index.href({ handle: 'demo' }),
    routes.settings.index.href(),
    routes.author.index.href(),
    routes.author.course.index.href({ course: 'prompting-101' }),
    routes.author.course.preview.href({ course: 'prompting-101', lesson: 'what-is-a-token' }),
  ]

  for (let path of pages) {
    it(`GET ${path} renders a page`, async () => {
      let response = await request(path)
      assert.equal(response.status, 200)
      assert.match(await response.text(), /<main id="main"/)
    })
  }

  it('GET /styleguide renders the design system, noindex', async () => {
    let response = await request(routes.styleguide.index.href())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex')
    let html = await response.text()
    assert.match(html, /<meta name="robots" content="noindex"/)
    assert.match(html, /Ink, Volt &amp; Ion\./)
    assert.match(html, /bits \/ system/)
  })

  it('GET /health reports ok', async () => {
    let response = await request(routes.health.href())
    assert.equal(response.status, 200)
    assert.equal((await response.json()).ok, true)
  })

  it('POST /login redirects a valid email to /login/check', async () => {
    let response = await request(
      routes.login.action.href(),
      form({ email: ' Ada@Example.com ', mode: 'signin', next: '/courses' }),
    )
    assert.equal(response.status, 303)
    let location = new URL(response.headers.get('Location')!, 'http://localhost')
    assert.equal(location.pathname, routes.login.check.index.href())
    assert.equal(location.searchParams.get('email'), 'ada@example.com')
    assert.equal(location.searchParams.get('next'), '/courses')
  })

  it('POST /login drops an off-site next path', async () => {
    let response = await request(
      routes.login.action.href(),
      form({ email: 'ada@example.com', next: '//evil.example' }),
    )
    assert.equal(response.status, 303)
    let location = new URL(response.headers.get('Location')!, 'http://localhost')
    assert.equal(location.searchParams.get('next'), null)
  })

  it('POST /login re-renders invalid input with 422', async () => {
    let response = await request(routes.login.action.href(), form({ email: 'not-an-email' }))
    assert.equal(response.status, 422)
    let html = await response.text()
    assert.match(html, /role="alert"/)
    assert.match(html, /aria-invalid/)
  })

  it('POST /auth/verify validates the 6-digit code', async () => {
    let bad = await request(routes.auth.verify.action.href(), form({ email: 'a@b.co', code: '12' }))
    assert.equal(bad.status, 422)
    let ok = await request(routes.auth.verify.action.href(), form({ email: 'a@b.co', code: '123 456' }))
    assert.equal(ok.status, 501)
  })

  it('API and webhook endpoints answer 501', async () => {
    for (let path of [
      routes.api.progress.href(),
      routes.api.passkey.href({ step: 'register-options' }),
      routes.webhooks.github.href(),
    ]) {
      let response = await request(path, { method: 'POST' })
      assert.equal(response.status, 501, path)
    }
  })

  it('serves CSS, fonts and the AppBarMenu clientEntry module', async () => {
    let html = await (await request(routes.home.href())).text()
    let data = JSON.parse(html.match(/<script type="application\/json" id="rmx-data">(.*?)<\/script>/s)![1]!)
    let hydrated = Object.values(data.h) as { exportName: string; moduleUrl: string }[]
    let menu = hydrated.find((entry) => entry.exportName === 'AppBarMenu')
    assert.ok(menu, 'AppBarMenu is hydrated as a clientEntry')

    let script = await request(menu.moduleUrl)
    assert.equal(script.status, 200)
    assert.match(script.headers.get('Content-Type') ?? '', /javascript/)

    let stylesheet = html.match(/<link rel="stylesheet" href="([^"]+tokens[^"]*)"/)![1]!
    let css = await request(stylesheet)
    assert.equal(css.status, 200)
    assert.match(await css.text(), /--volt/)

    let font = html.match(/<link rel="preload" as="font" type="font\/woff2" href="([^"]+)"/)![1]!
    assert.equal((await request(font)).status, 200)
  })
})
