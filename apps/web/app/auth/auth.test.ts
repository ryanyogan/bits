import { findUserByEmail, findUserById } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, form, requestCode, sessionCookieFrom, signIn, testDb, testIp } from '../test/auth.ts'
import { sha256Hex } from './crypto.ts'
import { userForOAuth } from './users.ts'

const verify = (fields: Record<string, string>, cookie: string | null = null) =>
  fetchAs(cookie, routes.auth.verify.action.href(), { method: 'POST', body: form(fields) })

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('auth', () => {
  after(() => disposePlatform())

  it('signs up with the code: creates a verified user with the sign-up answers', async () => {
    let { code } = await requestCode('ada@example.com', {
      mode: 'signup',
      displayName: 'Ada Lovelace',
      goals: ['code', 'teach'],
      timezone: 'Europe/London',
      next: '/courses/tokens-and-temperature',
    })
    let response = await verify({ email: 'ada@example.com', code })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/courses/tokens-and-temperature')

    let setCookie = response.headers.getSetCookie().find((value) => value.startsWith('__Host-session='))!
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /Secure/i)
    assert.match(setCookie, /SameSite=Lax/i)
    assert.match(setCookie, /Path=\//i)
    assert.match(setCookie, /Max-Age=2592000/i)
    assert.doesNotMatch(setCookie, /Domain=/i)

    let user = (await findUserByEmail(testDb, 'ada@example.com'))!
    assert.equal(user.display_name, 'Ada Lovelace')
    assert.equal(user.handle, 'ada_lovelace')
    assert.deepEqual(user.goals, ['code', 'teach'])
    assert.equal(user.timezone, 'Europe/London')
    assert.ok(user.email_verified_at)

    // D1 holds only the hash of the session id.
    let rows = await testDb.d1.prepare('select id, data from sessions where user_id = ?').bind(user.id).all<{ id: string }>()
    assert.equal(rows.results.length, 1)
    assert.match(rows.results[0]!.id, /^[0-9a-f]{64}$/)

    let me = await fetchAs(sessionCookieFrom(response), routes.me.index.href())
    assert.equal(me.status, 200)
  })

  it('stores only hashes of the token and code', async () => {
    let { code, token } = await requestCode('hashes@example.com')
    let row = await testDb.d1
      .prepare('select token_hash, code_hash from email_tokens where email = ?')
      .bind('hashes@example.com')
      .first<{ token_hash: string; code_hash: string }>()
    assert.equal(row!.token_hash, await sha256Hex(token))
    assert.notEqual(row!.code_hash, code)
    assert.doesNotMatch(row!.code_hash, new RegExp(code))
  })

  it('magic link: GET confirms without spending the token, POST signs in once', async () => {
    let { token } = await requestCode('link@example.com', { next: '/me' })
    let href = routes.auth.verify.index.href(undefined, { searchParams: { token } })

    for (let i = 0; i < 2; i++) {
      // A mail scanner opening the link twice changes nothing.
      let confirm = await fetchAs(null, href)
      assert.equal(confirm.status, 200)
      let html = await confirm.text()
      assert.match(html, /link@example\.com/)
      assert.match(html, new RegExp(`name="token" value="${token}"`))
      assert.equal(sessionCookieFrom(confirm), null)
    }

    let response = await verify({ token })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/me')
    assert.ok(sessionCookieFrom(response))

    let replay = await verify({ token })
    assert.equal(replay.status, 303)
    assert.equal(replay.headers.get('Location'), '/login?error=link-expired')
    assert.equal((await fetchAs(null, href)).headers.get('Location'), '/login?error=link-expired')
  })

  it('a code works once', async () => {
    let { code } = await requestCode('once@example.com')
    assert.equal((await verify({ email: 'once@example.com', code })).status, 303)
    let again = await verify({ email: 'once@example.com', code })
    assert.equal(again.status, 422)
  })

  it('locks the code after 5 wrong tries; the link still works', async () => {
    let { code, token } = await requestCode('guess@example.com')
    let wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      let response = await verify({ email: 'guess@example.com', code: wrong })
      assert.equal(response.status, 422)
    }
    let right = await verify({ email: 'guess@example.com', code })
    assert.equal(right.status, 422, 'the right code is refused after 5 misses')
    assert.match(await right.text(), /too many tries/)
    assert.equal((await verify({ token })).status, 303)
  })

  it('limits sign-in emails to 3 per address per 10 minutes', async () => {
    for (let i = 0; i < 3; i++) await requestCode('limited@example.com')
    let response = await fetchAs(null, routes.login.action.href(), {
      method: 'POST',
      headers: { 'CF-Connecting-IP': testIp() },
      body: form({ email: 'limited@example.com' }),
    })
    assert.equal(response.status, 429)
    assert.match(await response.text(), /3 emails in the last 10 minutes/)
  })

  it('limits sign-in emails to 20 per IP per hour', async () => {
    let send = (i: number) =>
      fetchAs(null, routes.login.action.href(), {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '198.51.100.7' },
        body: form({ email: `ip-${i}@example.com` }),
      })
    for (let i = 0; i < 20; i++) assert.equal((await send(i)).status, 303)
    assert.equal((await send(20)).status, 429)
  })

  it('signing in again reuses the account; an unknown email creates one (no passwords)', async () => {
    let first = await signIn('again@example.com')
    let second = await signIn('again@example.com')
    assert.equal(first.user.id, second.user.id)
    assert.notEqual(first.cookie, second.cookie)
  })

  it('logout deletes the session row and clears the cookie', async () => {
    let { cookie, user } = await signIn('logout@example.com')
    let response = await fetchAs(cookie, routes.logout.action.href(), { method: 'POST' })
    assert.equal(response.status, 303)
    assert.match(response.headers.getSetCookie().join('\n'), /__Host-session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    let rows = await testDb.d1.prepare('select count(*) as n from sessions where user_id = ?').bind(user.id).first<{ n: number }>()
    assert.equal(rows!.n, 0)
    assert.equal((await fetchAs(cookie, routes.me.index.href())).status, 303)
  })

  it('rotates the session id at sign-in and ignores unknown or tampered cookies', async () => {
    // An anonymous session (OAuth start would create one) does not carry over.
    let tampered = await fetchAs('__Host-session=not-a-signed-value', routes.me.index.href())
    assert.equal(tampered.status, 303)
    let { cookie } = await signIn('rotate@example.com')
    let forged = cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))
    assert.equal((await fetchAs(forged, routes.me.index.href())).status, 303)
  })

  it('a signed-in visit to /login goes straight to next', async () => {
    let { cookie } = await signIn('already@example.com')
    let response = await fetchAs(cookie, routes.login.index.href(undefined, { searchParams: { next: '/me' } }))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/me')
  })

  it('rejects cross-origin POSTs but lets webhooks through', async () => {
    let { cookie } = await signIn('cop@example.com')
    let crossSite = await fetchAs(cookie, routes.logout.action.href(), {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    assert.equal(crossSite.status, 403)
    let foreignOrigin = await fetchAs(cookie, routes.settings.sessions.href(), {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    })
    assert.equal(foreignOrigin.status, 403)
    assert.equal((await fetchAs(cookie, routes.me.index.href())).status, 200, 'still signed in')

    let sameOrigin = await fetchAs(cookie, routes.logout.action.href(), {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin', Origin: 'http://localhost' },
    })
    assert.equal(sameOrigin.status, 303)

    let webhook = await fetchAs(null, routes.webhooks.github.href(), {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    assert.equal(webhook.status, 501)
  })

  it('OAuth: unconfigured providers send people back to /login; unknown ones 404', async () => {
    let github = await fetchAs(null, routes.auth.oauth.start.href({ provider: 'github' }))
    assert.equal(github.status, 303)
    assert.equal(github.headers.get('Location'), '/login?error=github-unavailable')
    let html = await (await fetchAs(null, github.headers.get('Location')!)).text()
    assert.match(html, /GitHub sign-in isn(?:'|’|&#39;)t switched on yet/)
    assert.equal((await fetchAs(null, routes.auth.oauth.start.href({ provider: 'myspace' }))).status, 404)
  })

  it('OAuth accounts: link by verified email, refuse without one, never steal an identity', async () => {
    let { user: grace } = await signIn('grace@example.com')
    let linked = await userForOAuth(
      testDb,
      { provider: 'github', providerUserId: 'gh-1', email: 'grace@example.com', name: 'Grace', username: 'grace' },
      null,
    )
    assert.ok(linked.ok && linked.user.id === grace.id && !linked.created)

    let again = await userForOAuth(
      testDb,
      { provider: 'github', providerUserId: 'gh-1', email: null, name: null, username: null },
      null,
    )
    assert.ok(again.ok && again.user.id === grace.id, 'a known identity signs in without an email')

    let fresh = await userForOAuth(
      testDb,
      { provider: 'google', providerUserId: 'g-9', email: 'new.person@example.com', name: 'New Person', username: 'new.person' },
      null,
    )
    assert.ok(fresh.ok && fresh.created)
    assert.equal((await findUserById(testDb, fresh.ok ? fresh.user.id : ''))?.display_name, 'New Person')

    let noEmail = await userForOAuth(
      testDb,
      { provider: 'github', providerUserId: 'gh-2', email: null, name: null, username: 'x' },
      null,
    )
    assert.deepEqual(noEmail, { ok: false, reason: 'no-email' })

    let { user: other } = await signIn('other@example.com')
    let steal = await userForOAuth(
      testDb,
      { provider: 'github', providerUserId: 'gh-1', email: null, name: null, username: null },
      other,
    )
    assert.deepEqual(steal, { ok: false, reason: 'taken' })
  })
})
