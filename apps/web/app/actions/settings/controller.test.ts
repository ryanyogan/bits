import { findUserByEmail, linkIdentity } from '@bits/db'
import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { fetchAs, form, signIn, testDb } from '../../test/auth.ts'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

const post = (fields: Record<string, string>) => ({ method: 'POST', body: form(fields) })

describe('/settings', () => {
  let cookie: string

  before(async () => {
    ;({ cookie } = await signIn('jamie@example.com', { displayName: 'Jamie Park' }))
  })

  it('renders every section with one h1 and plain POST forms', async () => {
    let user = (await findUserByEmail(testDb, 'jamie@example.com'))!
    await linkIdentity(testDb, { provider: 'github', providerUserId: '42', userId: user.id, email: 'jamie@example.com', now: Date.now() })
    let response = await fetchAs(cookie, routes.settings.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Settings · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    for (let id of ['profile', 'email', 'sign-in', 'data', 'sessions', 'danger']) {
      assert.match(html, new RegExp(`id="${id}"`), id)
    }
    for (let action of ['/settings/profile', '/settings/email', '/settings/methods', '/settings/sessions', '/settings/delete']) {
      assert.match(html, new RegExp(`method="post" action="${action}"`), action)
    }
    // Downloads and OAuth leave client navigation (F4, F3).
    assert.match(html, /href="\/settings\/export" download=""/)
    assert.match(html, /name="visibility" value="public"[^>]*checked/)
    assert.match(html, /Disconnect GitHub/, 'linked GitHub identity shows Disconnect')
    assert.match(html, /href="\/auth\/oauth\/google\?link=1&amp;next=%2Fsettings" data-rmx-document=""/, 'Google offers Connect')
    assert.match(html, /This device/)
    assert.match(html, /<legend[^>]*>Profile visibility<\/legend>/)
  })

  it('sends signed-out visitors to /login?next=/settings', async () => {
    let response = await fetchAs(null, routes.settings.index.href())
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/login?next=%2Fsettings')
  })

  it('shows a success callout after a save', async () => {
    let html = await (await fetchAs(cookie, '/settings?saved=profile')).text()
    assert.match(html, /role="status"/)
    assert.match(html, /Saved\. Your profile is up to date\./)
  })

  it('saves the profile to D1, rejects a taken or reserved handle with 422', async () => {
    await signIn('taken@example.com', { displayName: 'Taken' })
    let ok = await fetchAs(cookie, routes.settings.profile.href(), post({ name: 'Jamie P', handle: 'jamie-p', visibility: 'private' }))
    assert.equal(ok.status, 303)
    assert.match(ok.headers.get('Location')!, /^\/settings\?saved=profile/)
    let user = (await findUserByEmail(testDb, 'jamie@example.com'))!
    assert.equal(user.display_name, 'Jamie P')
    assert.equal(user.handle, 'jamie-p')
    assert.equal(user.is_public, false)

    for (let handle of ['admin', 'taken']) {
      let taken = await fetchAs(cookie, routes.settings.profile.href(), post({ name: 'Jamie', handle, visibility: 'public' }))
      assert.equal(taken.status, 422, handle)
      let html = await taken.text()
      assert.match(html, /That handle is taken\./)
      assert.match(html, /aria-invalid="true"/)
    }
  })

  it('validates the new email and changes nothing until it is confirmed', async () => {
    assert.equal((await fetchAs(cookie, routes.settings.email.href(), post({ email: 'x' }))).status, 422)
    assert.equal((await fetchAs(cookie, routes.settings.email.href(), post({ email: 'Jamie@Example.com' }))).status, 422)
    let ok = await fetchAs(cookie, routes.settings.email.href(), post({ email: 'new@example.com' }))
    assert.equal(ok.status, 303)
    assert.match(ok.headers.get('Location')!, /saved=email-sent/)
    assert.equal((await findUserByEmail(testDb, 'jamie@example.com'))?.email, 'jamie@example.com')
    let html = await (await fetchAs(cookie, routes.settings.index.href())).text()
    assert.match(html, /Check <span[^>]*>new@example\.com<\/span>/)
    let cancel = await fetchAs(cookie, routes.settings.email.href(), post({ intent: 'cancel' }))
    assert.match(cancel.headers.get('Location')!, /saved=email-cancelled/)
    assert.doesNotMatch(await (await fetchAs(cookie, routes.settings.index.href())).text(), /new@example\.com/)
  })

  it('disconnects a provider', async () => {
    let response = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'disconnect:github' }))
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location')!, /saved=disconnected&method=github/)
    let html = await (await fetchAs(cookie, routes.settings.index.href())).text()
    assert.doesNotMatch(html, /Disconnect GitHub/)
    let passkey = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'add-passkey' }))
    assert.match(passkey.headers.get('Location')!, /saved=passkey-needs-js/)
  })

  it('downloads a JSON export of the real account', async () => {
    let response = await fetchAs(cookie, routes.settings.export.href())
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Disposition') ?? '', /attachment; filename="bits-jamie-p\.json"/)
    let body = await response.json()
    assert.equal(body.account.handle, 'jamie-p')
    assert.equal(body.account.email, 'jamie@example.com')
  })

  it('signs out everywhere: every session of the user stops working', async () => {
    let second = await signIn('jamie@example.com')
    let response = await fetchAs(cookie, routes.settings.sessions.href(), { method: 'POST' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/login?notice=signed-out-everywhere')
    for (let session of [cookie, second.cookie]) {
      let page = await fetchAs(session, routes.settings.index.href())
      assert.equal(page.status, 303, 'old sessions are signed out')
    }
  })

  it('deletes the account only when the handle is typed', async () => {
    let { cookie: doomed } = await signIn('doomed@example.com', { displayName: 'Doomed' })
    let wrong = await fetchAs(doomed, routes.settings.deleteAccount.href(), post({ confirm: 'nope' }))
    assert.equal(wrong.status, 422)
    assert.match(await wrong.text(), /Type doomed exactly to confirm\./)
    let right = await fetchAs(doomed, routes.settings.deleteAccount.href(), post({ confirm: '@Doomed' }))
    assert.equal(right.status, 303)
    assert.equal(await findUserByEmail(testDb, 'doomed@example.com'), null)
    assert.equal((await fetchAs(doomed, routes.settings.index.href())).status, 303)
  })
})
