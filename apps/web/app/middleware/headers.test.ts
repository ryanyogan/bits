import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, requestCode, signIn } from '../test/auth.ts'
import { CSP_REPORT_PATH } from './headers.ts'

// One flat suite: remix test runs after() around every describe.
describe('response headers', () => {
  after(() => disposePlatform())

  it('HTML pages get the security headers and private, no-cache', async () => {
    for (let path of [routes.home.href(), routes.courses.index.href(), '/no-such-page']) {
      let response = await fetchAs(null, path)
      assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains', path)
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', path)
      assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin', path)
      assert.match(response.headers.get('Permissions-Policy') ?? '', /camera=\(\)/, path)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-cache', path)
      // No validator: a 304 can't pair a cached body with a fresh nonce (decision 045).
      assert.equal(response.headers.get('ETag'), null, path)
      assert.equal(response.headers.get('Last-Modified'), null, path)
      let csp = response.headers.get('Content-Security-Policy') ?? ''
      let html = await response.text()
      let nonce = /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1]
      assert.ok(nonce, `${path}: a nonce in script-src`)
      for (let directive of [
        "'strict-dynamic'",
        "default-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        `report-uri ${CSP_REPORT_PATH}`,
      ]) {
        assert.ok(csp.includes(directive), `${path}: ${directive}`)
      }
      assert.ok(!csp.includes('report-to'), `${path}: report-uri only`)
      // Every script that runs carries this response's nonce (JSON data blocks don't run).
      let scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !tag.includes('application/json'))
      assert.ok(scripts.length >= 2, `${path}: the import map and the entry`)
      for (let tag of scripts) assert.ok(tag.includes(`nonce="${nonce}"`), `${path}: ${tag}`)
    }
  })

  it('makes a new nonce for every response', async () => {
    let nonces = new Set<string>()
    for (let i = 0; i < 3; i++) {
      let response = await fetchAs(null, routes.courses.index.href())
      nonces.add(/'nonce-([^']+)'/.exec(response.headers.get('Content-Security-Policy') ?? '')?.[1] ?? '')
      await response.text()
    }
    assert.equal(nonces.size, 3)
    assert.ok(!nonces.has(''))
  })

  it('logs CSP reports in both shapes, without query strings', async () => {
    let logged: string[] = []
    let warn = console.warn
    console.warn = (line: string) => logged.push(line)
    try {
      let legacy = await fetchAs(null, CSP_REPORT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'http://localhost/auth/verify?token=secret',
            'blocked-uri': 'inline',
            'effective-directive': 'script-src-elem',
          },
        }),
      })
      assert.equal(legacy.status, 204)
      let modern = await fetchAs(null, CSP_REPORT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/reports+json' },
        body: JSON.stringify([
          {
            type: 'csp-violation',
            body: { documentURL: 'http://localhost/me', blockedURL: 'https://evil.example/x.js?a=1', effectiveDirective: 'script-src-elem' },
          },
          { type: 'deprecation', body: {} },
        ]),
      })
      assert.equal(modern.status, 204)
      let junk = await fetchAs(null, CSP_REPORT_PATH, { method: 'POST', body: 'not json' })
      assert.equal(junk.status, 204)
    } finally {
      console.warn = warn
    }
    let violations = logged.map((line) => JSON.parse(line)).filter((entry) => entry.message === 'CSP violation')
    assert.equal(violations.length, 2)
    assert.equal(violations[0].csp.documentURL, 'http://localhost/auth/verify')
    assert.equal(violations[0].csp.blockedURL, 'inline')
    assert.equal(violations[1].csp.blockedURL, 'https://evil.example/x.js')
    assert.ok(!logged.join('').includes('secret'))
  })

  it('account and sign-in pages are no-store', async () => {
    let { cookie } = await signIn('headers@example.com')
    for (let path of [routes.settings.index.href(), routes.login.index.href(), routes.me.index.href()]) {
      let response = await fetchAs(path === routes.login.index.href() ? null : cookie, path)
      assert.equal(response.headers.get('Cache-Control'), 'no-store', path)
      await response.text()
    }
  })

  it('keeps headers an action set, and adds no CSP or cache default to non-HTML', async () => {
    // The magic-link confirm page keeps its own no-referrer.
    let { token } = await requestCode('headers-link@example.com')
    let confirm = await fetchAs(null, routes.auth.verify.index.href(undefined, { searchParams: { token } }))
    assert.equal(confirm.status, 200)
    assert.equal(confirm.headers.get('Referrer-Policy'), 'no-referrer')
    assert.equal(confirm.headers.get('Cache-Control'), 'no-store')
    assert.match(confirm.headers.get('Content-Security-Policy') ?? '', /'strict-dynamic'/)
    await confirm.text()

    let health = await fetchAs(null, routes.health.href())
    assert.equal(health.headers.get('Cache-Control'), 'no-store')
    assert.equal(health.headers.get('Content-Security-Policy'), null)
    assert.equal(health.headers.get('X-Content-Type-Options'), 'nosniff')
    await health.text()

    // Redirects (immutable headers) get them too.
    let redirect = await fetchAs(null, routes.settings.index.href())
    assert.equal(redirect.status, 303)
    assert.equal(redirect.headers.get('X-Content-Type-Options'), 'nosniff')
  })
})
