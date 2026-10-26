import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

function request(path: string, init?: RequestInit) {
  return router.fetch(new Request(new URL(path, 'http://localhost'), init))
}

function post(fields: Record<string, string>) {
  let body = new FormData()
  for (let [name, value] of Object.entries(fields)) body.set(name, value)
  return { method: 'POST', body }
}

describe('/settings', () => {
  it('renders every section with one h1 and plain POST forms', async () => {
    let response = await request(routes.settings.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Settings · bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    for (let id of ['profile', 'email', 'sign-in', 'data', 'sessions', 'danger']) {
      assert.match(html, new RegExp(`id="${id}"`), id)
    }
    for (let action of ['/settings/profile', '/settings/email', '/settings/methods', '/settings/sessions', '/settings/delete']) {
      assert.match(html, new RegExp(`method="post" action="${action}"`), action)
    }
    assert.match(html, /href="\/settings\/export"/)
    assert.match(html, /name="visibility" value="public"[^>]*checked/)
    assert.match(html, /Remove passkey/)
    assert.match(html, /Disconnect GitHub/)
    assert.match(html, /<legend[^>]*>Profile visibility<\/legend>/)
  })

  it('sends signed-out visitors to /login?next=/settings', async () => {
    let response = await request(routes.settings.index.href(undefined, { searchParams: { as: 'anon' } }))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/login?next=%2Fsettings')
  })

  it('shows a success callout after a save', async () => {
    let html = await (await request('/settings?saved=profile')).text()
    assert.match(html, /role="status"/)
    assert.match(html, /Saved\. Your profile is up to date\./)
  })

  it('saves the profile with a 303, rejects a taken handle with 422', async () => {
    let ok = await request(routes.settings.profile.href(), post({ name: 'Jamie', handle: 'jamie-p', visibility: 'private' }))
    assert.equal(ok.status, 303)
    assert.match(ok.headers.get('Location')!, /^\/settings\?saved=profile/)
    let taken = await request(routes.settings.profile.href(), post({ name: 'Jamie', handle: 'admin', visibility: 'public' }))
    assert.equal(taken.status, 422)
    let html = await taken.text()
    assert.match(html, /That handle is taken\./)
    assert.match(html, /aria-invalid="true"/)
  })

  it('validates the new email', async () => {
    assert.equal((await request(routes.settings.email.href(), post({ email: 'x' }))).status, 422)
    let ok = await request(routes.settings.email.href(), post({ email: 'new@example.com' }))
    assert.equal(ok.status, 303)
    assert.match(ok.headers.get('Location')!, /saved=email&email=new%40example\.com/)
  })

  it('handles sign-in method and session stubs', async () => {
    for (let [intent, saved] of [['remove:pk_macbook', 'removed'], ['disconnect:github', 'disconnected'], ['add-passkey', 'passkey-needs-js']]) {
      let response = await request(routes.settings.methods.href(), post({ intent: intent! }))
      assert.equal(response.status, 303)
      assert.match(response.headers.get('Location')!, new RegExp(`saved=${saved}`))
    }
    let sessions = await request(routes.settings.sessions.href(), { method: 'POST' })
    assert.equal(sessions.status, 303)
  })

  it('deletes only when the handle is typed', async () => {
    let wrong = await request(routes.settings.deleteAccount.href(), post({ confirm: 'nope' }))
    assert.equal(wrong.status, 422)
    assert.match(await wrong.text(), /Type jamie exactly to confirm\./)
    let right = await request(routes.settings.deleteAccount.href(), post({ confirm: '@Jamie' }))
    assert.equal(right.status, 303)
  })

  it('downloads a JSON export', async () => {
    let response = await request(routes.settings.export.href())
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Disposition') ?? '', /attachment; filename="bits-jamie\.json"/)
    assert.equal((await response.json()).account.handle, 'jamie')
  })
})
