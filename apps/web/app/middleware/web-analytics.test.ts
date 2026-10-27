import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs } from '../test/auth.ts'

const TOKEN = '0123456789abcdef0123456789abcdef'

/** Runs `body` with WEB_ANALYTICS_TOKEN set, then puts the test default (unset) back. */
async function withToken<T>(token: string | undefined, body: () => Promise<T>): Promise<T> {
  let env = platform.env as { WEB_ANALYTICS_TOKEN?: string }
  let before = env.WEB_ANALYTICS_TOKEN
  env.WEB_ANALYTICS_TOKEN = token
  try {
    return await body()
  } finally {
    env.WEB_ANALYTICS_TOKEN = before
  }
}

async function page(path: string, headers: Record<string, string> = {}) {
  let response = await fetchAs(null, path, { headers })
  let csp = response.headers.get('Content-Security-Policy') ?? ''
  let html = await response.text()
  let beacon = /<script\b[^>]*static\.cloudflareinsights\.com[^>]*>/.exec(html)?.[0]
  let connectSrc = /connect-src ([^;]*)/.exec(csp)?.[1] ?? ''
  let nonce = /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1]
  return { status: response.status, html, beacon, connectSrc, nonce }
}

// One flat suite: remix test runs after() around every describe.
describe('Cloudflare Web Analytics (decision 033)', () => {
  after(() => disposePlatform())

  it('renders no beacon and no extra connect-src without a token', async () => {
    for (let token of [undefined, '', '  ']) {
      await withToken(token, async () => {
        let { beacon, connectSrc } = await page(routes.courses.index.href())
        assert.equal(beacon, undefined, `token ${JSON.stringify(token)}`)
        assert.equal(connectSrc, "'self'")
      })
    }
  })

  it('adds the nonced beacon and its report origin with a token', async () => {
    await withToken(TOKEN, async () => {
      for (let path of [routes.home.href(), routes.courses.index.href(), routes.login.index.href(), '/no-such-page']) {
        let { beacon, connectSrc, nonce } = await page(path)
        assert.ok(beacon, `${path}: beacon`)
        assert.ok(nonce)
        assert.ok(beacon.includes('src="https://static.cloudflareinsights.com/beacon.min.js"'), beacon)
        assert.ok(beacon.includes('type="module"'), beacon)
        assert.ok(beacon.includes(`nonce="${nonce}"`), `${path}: nonced`)
        assert.ok(beacon.includes(`"token":"${TOKEN}"`) || beacon.includes(`&quot;token&quot;:&quot;${TOKEN}&quot;`), beacon)
        assert.equal(connectSrc, "'self' https://cloudflareinsights.com", path)
      }
    })
  })

  it('leaves the beacon out when the browser sends Global Privacy Control', async () => {
    await withToken(TOKEN, async () => {
      let { beacon } = await page(routes.courses.index.href(), { 'Sec-GPC': '1' })
      assert.equal(beacon, undefined)
    })
  })

  it('says on /privacy whether page views are counted', async () => {
    let off = await page(routes.legal.privacy.href())
    assert.match(off.html, /No ads, no analytics/)
    assert.doesNotMatch(off.html, /Web Analytics/)
    await withToken(TOKEN, async () => {
      let on = await page(routes.legal.privacy.href())
      assert.doesNotMatch(on.html, /no analytics/)
      assert.match(on.html, /Cloudflare Web Analytics/)
      assert.match(on.html, /sets no cookies/)
      assert.match(on.html, /Global Privacy Control/)
    })
  })
})
