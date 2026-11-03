import { findUserByEmail, linkIdentity } from '@bits/db'
import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { ageSessions, answerAsk, fetchAs, form, signIn, testDb } from '../../test/auth.ts'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

const post = (fields: Record<string, string>) => ({ method: 'POST', body: form(fields) })

/** The section of /settings with this id, as HTML: where a write's notice shows (decision 068). */
async function section(cookie: string, id: string): Promise<string> {
  let html = await (await fetchAs(cookie, routes.settings.index.href())).text()
  let start = html.indexOf(`<section aria-labelledby="${id}-heading"`)
  assert.ok(start >= 0, `section ${id}`)
  return html.slice(start, html.indexOf('</section>', start))
}

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
    assert.match(html, /<title>Settings · bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    for (let id of ['profile', 'email', 'sign-in', 'data', 'sessions', 'danger']) {
      assert.match(html, new RegExp(`id="${id}"`), id)
    }
    for (let action of ['/settings/profile', '/settings/email', '/settings/methods', '/settings/sessions', '/settings/delete']) {
      assert.match(html, new RegExp(`method="post" action="${action}"`), action)
    }
    // Downloads and OAuth leave client navigation (F4, F3).
    assert.match(html, /href="\/settings\/export" download=""/)
    // New accounts start private (decision 068).
    assert.match(html, /name="visibility" value="private"[^>]*checked/)
    // The handle's prefix is this site, not a made-up domain.
    assert.match(html, /localhost\/u\//)
    assert.match(html, /Disconnect GitHub/, 'linked GitHub identity shows Disconnect')
    assert.match(html, /href="\/auth\/oauth\/google\?link=1&amp;next=%2Fsettings" data-rmx-document=""/, 'Google offers Connect')
    assert.match(html, /This device/)
    assert.match(html, /<legend[^>]*>Profile visibility<\/legend>/)
  })

  it('reads the page in two round trips: the session, then one settings batch (decision 045)', async () => {
    let response = await fetchAs(cookie, routes.settings.index.href())
    assert.equal(response.status, 200)
    // The session read (user + session), then identities, sessions, passkeys
    // and the open email change in one db.batch.
    assert.match(response.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="5 queries, 2 round trips"$/)
    await response.text()
  })

  it('sends signed-out visitors to /login?next=/settings', async () => {
    let response = await fetchAs(null, routes.settings.index.href())
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/login?next=%2Fsettings')
  })

  it('shows a save notice once, inside the section that saved (decision 068)', async () => {
    let response = await fetchAs(cookie, routes.settings.appearance.href(), post({ theme: 'light' }))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/settings#appearance')
    let appearance = await section(cookie, 'appearance')
    assert.match(appearance, /role="status"[^>]*>.*Saved\. Every page uses this theme now/s)
    // A flash: a reload, or a ?saved= link, shows nothing.
    assert.doesNotMatch(await section(cookie, 'appearance'), /Saved\./)
    assert.doesNotMatch(await (await fetchAs(cookie, '/settings?saved=profile')).text(), /Saved\. Your profile/)
    await fetchAs(cookie, routes.settings.appearance.href(), post({ theme: 'system' }))
  })

  it('re-renders 422 with the problem for a bad theme or passkey name', async () => {
    let theme = await fetchAs(cookie, routes.settings.appearance.href(), post({ theme: 'purple' }))
    assert.equal(theme.status, 422)
    assert.match(await theme.text(), /Pick System, Dark or Light\./)
    let rename = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'rename:nope', name: '' }))
    assert.equal(rename.status, 422)
    assert.match(await rename.text(), /Give the passkey a name/)
  })

  it('saves the profile to D1, rejects a taken or reserved handle with 422', async () => {
    await signIn('taken@example.com', { displayName: 'Taken', handle: 'taken' })
    let ok = await fetchAs(cookie, routes.settings.profile.href(), post({ name: 'Jamie P', handle: 'jamie-p', visibility: 'private' }))
    assert.equal(ok.status, 303)
    assert.equal(ok.headers.get('Location'), '/settings#profile')
    assert.match(await section(cookie, 'profile'), /Saved\. Your profile is up to date\./)
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
      assert.match(html, /Check the highlighted field\./)
    }
    // Two bad fields: the summary counts them.
    let both = await fetchAs(cookie, routes.settings.profile.href(), post({ name: '', handle: 'x', visibility: 'public' }))
    assert.equal(both.status, 422)
    assert.match(await both.text(), /Check the 2 highlighted fields\./)
  })

  it('validates the new email and changes nothing until it is confirmed', async () => {
    assert.equal((await fetchAs(cookie, routes.settings.email.href(), post({ email: 'x' }))).status, 422)
    assert.equal((await fetchAs(cookie, routes.settings.email.href(), post({ email: 'Jamie@Example.com' }))).status, 422)
    let ok = await fetchAs(cookie, routes.settings.email.href(), post({ email: 'new@example.com' }))
    assert.equal(ok.status, 303)
    assert.equal(ok.headers.get('Location'), '/settings#email')
    assert.equal((await findUserByEmail(testDb, 'jamie@example.com'))?.email, 'jamie@example.com')
    let html = await section(cookie, 'email')
    assert.match(html, /Check your new inbox\./)
    assert.match(html, /Check <span[^>]*>new@example\.com<\/span>/)
    // Confirm and Cancel sit in one row; Cancel submits its own form.
    assert.match(html, /<button[^>]*name="intent" value="cancel" form="email-cancel"/)
    let cancel = await fetchAs(cookie, routes.settings.email.href(), post({ intent: 'cancel' }))
    assert.equal(cancel.headers.get('Location'), '/settings#email')
    assert.match(await section(cookie, 'email'), /Cancelled\. Your email hasn’t changed\./)
    assert.doesNotMatch(await (await fetchAs(cookie, routes.settings.index.href())).text(), /new@example\.com/)
  })

  it('disconnects a provider', async () => {
    let response = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'disconnect:github' }))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/settings#sign-in')
    let html = await section(cookie, 'sign-in')
    assert.match(html, /GitHub disconnected\./)
    assert.doesNotMatch(html, /Disconnect GitHub/)
    let passkey = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'add-passkey' }))
    assert.equal(passkey.headers.get('Location'), '/settings#sign-in')
    assert.match(await section(cookie, 'sign-in'), /Adding a passkey needs JavaScript/)
  })

  it('a stale session gets one confirm box, no passkey option without passkeys, and Connect disabled', async () => {
    let { cookie: stale, user } = await signIn('stale-settings@example.com')
    await ageSessions(user.id)
    let html = await (await fetchAs(stale, routes.settings.index.href())).text()
    assert.equal(html.match(/confirm it’s you first/g)?.length, 1, 'one step-up box')
    assert.match(html, /id="confirm-it"/)
    assert.doesNotMatch(html, /Use a passkey/, 'no passkey to use')
    assert.match(html, /No passkeys yet\./)
    assert.match(html, /aria-disabled="true"[^>]*>Connect|Connect[^<]*<\/a>/)
    assert.doesNotMatch(html, /href="\/auth\/oauth\/google/, 'Connect is not a live link')
    assert.match(html, /href="#confirm-it"/)
    // A refused change lands in Email, next to the box.
    let refused = await fetchAs(stale, routes.settings.email.href(), post({ email: 'elsewhere@example.com' }))
    assert.equal(refused.headers.get('Location'), '/settings#email')
    assert.match(await section(stale, 'email'), /confirm it’s you first, below/)
  })

  it('downloads a JSON export of the real account, quick-check answers included', async () => {
    await answerAsk(cookie, 'tokens-and-temperature', 'what-is-a-token', 'common-words', 'b')
    let response = await fetchAs(cookie, routes.settings.export.href())
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Disposition') ?? '', /attachment; filename="bits-jamie-p\.json"/)
    let body = await response.json()
    assert.equal(body.account.handle, 'jamie-p')
    assert.equal(body.account.email, 'jamie@example.com')
    assert.deepEqual(
      body.answers.map((row: { ask: string; answer: string; correct: boolean }) => [row.ask, row.answer, row.correct]),
      [['common-words', 'b', false]],
    )
    // The lesson depth (decision 053): null until picked, then the saved choice.
    assert.equal(body.account.lessonDepth, null)
    await fetchAs(cookie, '/courses/plain-course/lesson-1?depth=engineer')
    let again = await (await fetchAs(cookie, routes.settings.export.href())).json()
    assert.equal(again.account.lessonDepth, 'engineer')
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
    let { cookie: doomed } = await signIn('doomed@example.com', { displayName: 'Doomed', handle: 'doomed' })
    // An open author invite to the address goes with the account (decision 037).
    await testDb.d1
      .prepare(`insert into author_invites (id, token_hash, email, courses, expires_at, created_at) values ('inv-doomed', 'hash-doomed', 'doomed@example.com', '[]', ?1, ?1)`)
      .bind(Date.now() + 60_000)
      .run()
    let wrong = await fetchAs(doomed, routes.settings.deleteAccount.href(), post({ confirm: 'nope' }))
    assert.equal(wrong.status, 422)
    assert.match(await wrong.text(), /Type doomed exactly to confirm\./)
    let right = await fetchAs(doomed, routes.settings.deleteAccount.href(), post({ confirm: '@Doomed' }))
    assert.equal(right.status, 303)
    assert.equal(await findUserByEmail(testDb, 'doomed@example.com'), null)
    let invites = await testDb.d1.prepare(`select count(*) as n from author_invites where email = 'doomed@example.com'`).first<{ n: number }>()
    assert.equal(invites?.n, 0)
    assert.equal((await fetchAs(doomed, routes.settings.index.href())).status, 303)
  })
})
