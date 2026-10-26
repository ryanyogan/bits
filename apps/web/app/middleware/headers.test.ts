import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, requestCode, signIn } from '../test/auth.ts'
import { CONTENT_SECURITY_POLICY } from './headers.ts'

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
      assert.equal(response.headers.get('Content-Security-Policy'), CONTENT_SECURITY_POLICY, path)
      assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'self'/)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-cache', path)
      await response.text()
    }
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
    assert.equal(confirm.headers.get('Content-Security-Policy'), CONTENT_SECURITY_POLICY)
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
