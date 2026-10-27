// Sign-in on Workers Previews (decision 038): no mail, so the check page
// shows the code to the browser that asked for it, once.
import { users } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { outbox, sendMail } from '../../auth/mailer.ts'
import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { fetchAs, form, sessionCookieFrom, testDb, testIp } from '../../test/auth.ts'

describe('sign-in on a Workers Preview', () => {
  after(() => disposePlatform())

  function request(path: string) {
    return router.fetch(new Request(new URL(path, 'http://localhost')))
  }

  /** Runs `body` with the env a Preview has: APP_ENV=preview, no canonical origin, no EMAIL. */
  async function asPreview<T>(body: () => Promise<T>): Promise<T> {
    let env = platform.env as unknown as Record<string, unknown>
    let saved = { APP_ENV: env.APP_ENV, CANONICAL_ORIGIN: env.CANONICAL_ORIGIN, EMAIL: env.EMAIL }
    Object.assign(env, { APP_ENV: 'preview', CANONICAL_ORIGIN: undefined, EMAIL: undefined })
    try {
      return await body()
    } finally {
      Object.assign(env, saved)
    }
  }

  async function askForCode(email: string, cookie: string | null = null) {
    let response = await fetchAs(cookie, routes.login.action.href(), {
      method: 'POST',
      headers: { 'CF-Connecting-IP': testIp() },
      body: form({ email }),
    })
    assert.equal(response.status, 303)
    return { location: response.headers.get('Location')!, cookie: sessionCookieFrom(response) ?? cookie }
  }

  it('shows the code once, to the browser that asked, mails nothing, and signs in with it', async () => {
    await asPreview(async () => {
      let email = 'preview-reviewer@example.com'
      let sent = outbox.length
      let login = await (await request(routes.login.index.href())).text()
      assert.doesNotMatch(login, /Continue with GitHub|Continue with Google/, 'OAuth is hidden on previews')
      assert.match(login, /Use a passkey/)
      assert.match(login, /Get a sign-in code →/)

      let { location, cookie } = await askForCode(email)
      assert.equal(outbox.length, sent, 'nothing reaches the outbox')
      assert.ok(cookie, 'the code rides in the session')
      assert.doesNotMatch(location, /\d{6}/, 'never in the URL')

      let html = await (await fetchAs(cookie, location)).text()
      assert.match(html, /<title>Your sign-in code · Bits<\/title>/)
      assert.match(html, /Mail is off on this preview/)
      let code = /Preview sign-in code: <span[^>]*>(\d{6})<\/span>/.exec(html)?.[1]
      assert.ok(code, 'the code is on the page')
      assert.match(html, new RegExp(`name="code"[^>]*value="${code}"`), 'and filled in')

      // Shown once: a reload (or another browser) gets no code.
      let again = await (await fetchAs(cookie, location)).text()
      assert.doesNotMatch(again, /Preview sign-in code:/)
      assert.match(again, /The code is shown once/)
      let other = await (await request(location)).text()
      assert.doesNotMatch(other, /Preview sign-in code:/)

      let verified = await fetchAs(cookie, routes.auth.verify.action.href(), {
        method: 'POST',
        body: form({ email, code: code! }),
      })
      assert.equal(verified.status, 303)
      let user = await testDb.findOne(users, { where: { email } })
      assert.equal(user?.role, 'learner', 'a preview sign-in grants no role')
    })
  })

  it('drops other mail on a preview (email change, invites): no outbox, nothing sent', async () => {
    await asPreview(async () => {
      let sent = outbox.length
      await sendMail({ to: 'someone@example.com', subject: '123 456 is your code', text: 'x', html: 'x' })
      assert.equal(outbox.length, sent)
    })
  })

  it('production misread as a preview (APP_ENV=preview, but its origin and mail binding) still mails', async () => {
    let env = platform.env as unknown as Record<string, unknown>
    let saved = { APP_ENV: env.APP_ENV, CANONICAL_ORIGIN: env.CANONICAL_ORIGIN, EMAIL: env.EMAIL }
    for (let signals of [
      { APP_ENV: 'preview', CANONICAL_ORIGIN: 'https://bits.yogan.dev', EMAIL: undefined },
      { APP_ENV: 'preview', CANONICAL_ORIGIN: undefined, EMAIL: { send() {} } },
    ]) {
      Object.assign(env, signals)
      try {
        let email = `misread-${Object.keys(signals.EMAIL ?? {}).length}@example.com`
        let sent = outbox.length
        let { location, cookie } = await askForCode(email)
        assert.equal(outbox.length, sent + 1, 'the code went to the mailer, not the page')
        let html = await (await fetchAs(cookie, location)).text()
        assert.doesNotMatch(html, /Preview sign-in code|Mail is off/)
      } finally {
        Object.assign(env, saved)
      }
    }
  })

  it('outside a preview, never shows a code and keeps mailing', async () => {
    let email = 'not-a-preview@example.com'
    let sent = outbox.length
    let { location, cookie } = await askForCode(email)
    assert.equal(outbox.length, sent + 1)
    let html = await (await fetchAs(cookie, location)).text()
    assert.match(html, /Check your inbox\./)
    assert.doesNotMatch(html, /Preview sign-in code|Mail is off/)
    let login = await (await request(routes.login.index.href())).text()
    assert.match(login, /Continue with GitHub/)
  })
})
