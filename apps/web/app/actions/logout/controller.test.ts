import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { routes } from '../../routes.ts'
import { fetchAs, signIn } from '../../test/auth.ts'

describe('POST /logout', () => {
  after(() => disposePlatform())

  it('signs out and goes home', async () => {
    let { cookie } = await signIn('logout-ok@example.com')
    let response = await fetchAs(cookie, routes.logout.action.href(), { method: 'POST' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href())
  })

  it('past the burst limit is a 429 and keeps the session (decision 065)', async () => {
    let env = platform.env as unknown as Record<string, unknown>
    let { cookie } = await signIn('logout-limit@example.com')
    env.RL_LOGOUT = { limit: async () => ({ success: false }) }
    try {
      let response = await fetchAs(cookie, routes.logout.action.href(), { method: 'POST' })
      assert.equal(response.status, 429)
      assert.equal(response.headers.get('Retry-After'), '60')
    } finally {
      env.RL_LOGOUT = undefined
    }
    // Still signed in: /me renders instead of sending to /login.
    let me = await fetchAs(cookie, routes.me.index.href())
    assert.equal(me.status, 200)
  })
})
