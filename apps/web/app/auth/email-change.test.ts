// Changing the sign-in email (decision 030): code and link confirmation,
// uniqueness, the old-address notice and what happens to other sessions.
import { findUserByEmail, findUserById } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, form, requestCode, sessionCookieFrom, signIn, testDb, testIp } from '../test/auth.ts'
import { outbox } from './mailer.ts'

const post = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'CF-Connecting-IP': testIp() },
  body: form(fields),
})

async function askToChange(cookie: string, email: string) {
  let response = await fetchAs(cookie, routes.settings.email.href(), post({ email }))
  assert.equal(response.status, 303)
  assert.match(response.headers.get('Location')!, /saved=email-sent#email$/)
  let message = outbox.findLast((m) => m.to === email)!
  return {
    message,
    code: /code is (\d{6})/.exec(message.text)?.[1],
    token: /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1],
  }
}

// One flat suite: remix test runs after() around every describe.
describe('email change', () => {
  after(() => disposePlatform())

  it('confirms with the code: swaps the email, keeps this session, signs out the others, tells the old address', async () => {
    let { cookie, user } = await signIn('move-me@example.com')
    let { cookie: laptop } = await signIn('move-me@example.com')
    let { code, message } = await askToChange(cookie, 'moved@example.com')
    assert.ok(code, 'a code in the email')
    assert.match(message.subject, /confirmation code/)
    assert.match(message.text, /\/auth\/email\?token=/)

    // Nothing changes before confirmation.
    assert.equal((await findUserById(testDb, user.id))!.email, 'move-me@example.com')

    let wrong = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: code === '000000' ? '111111' : '000000' }))
    assert.equal(wrong.status, 422)
    assert.match(await wrong.text(), /That code isn’t right/)

    let ok = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: code! }))
    assert.equal(ok.status, 303)
    assert.match(ok.headers.get('Location')!, /saved=email-changed#email$/)
    let moved = (await findUserById(testDb, user.id))!
    assert.equal(moved.email, 'moved@example.com')
    assert.ok(moved.email_verified_at)

    let notice = outbox.findLast((m) => m.to === 'move-me@example.com')!
    assert.match(notice.subject, /email was changed/)
    assert.match(notice.text, /moved@example\.com/)

    assert.equal((await fetchAs(cookie, routes.settings.index.href())).status, 200, 'this session stays')
    assert.equal((await fetchAs(laptop, routes.settings.index.href())).status, 303, 'other sessions are signed out')

    // The new address signs in to the same account; the old one would make a new account.
    let again = await signIn('moved@example.com')
    assert.equal(again.user.id, user.id)
  })

  it('confirms with the link on another device and signs that browser in', async () => {
    let { cookie, user } = await signIn('link-move@example.com')
    let { token } = await askToChange(cookie, 'link-moved@example.com')
    assert.ok(token)

    let page = await fetchAs(null, routes.auth.email.index.href(undefined, { searchParams: { token: token! } }))
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('Cache-Control'), 'no-store')
    assert.match(await page.text(), /link-moved@example\.com/)
    // Looking doesn't spend it.
    assert.equal((await findUserById(testDb, user.id))!.email, 'link-move@example.com')

    let confirmed = await fetchAs(null, routes.auth.email.action.href(), post({ token: token! }))
    assert.equal(confirmed.status, 303)
    assert.match(confirmed.headers.get('Location')!, /saved=email-changed/)
    let session = sessionCookieFrom(confirmed)
    assert.ok(session)
    assert.match(await (await fetchAs(session, routes.settings.index.href())).text(), /link-moved@example\.com/)
    assert.equal((await fetchAs(cookie, routes.settings.index.href())).status, 303, 'the asking session is signed out too')

    let reused = await fetchAs(null, routes.auth.email.action.href(), post({ token: token! }))
    assert.equal(reused.headers.get('Location'), '/login?error=email-link-expired')
  })

  it('never reveals a taken address, and never lets two accounts share one', async () => {
    let { user: owner } = await signIn('owner@example.com')
    let { cookie, user } = await signIn('wants-it@example.com')
    let { code, message } = await askToChange(cookie, 'owner@example.com')
    assert.equal(code, undefined, 'no code goes to an address that has an account')
    assert.match(message.subject, /already has a Bits account/)
    // Settings shows the same "check your inbox" as for a free address.
    assert.match(await (await fetchAs(cookie, routes.settings.index.href())).text(), /Check <span[^>]*>owner@example\.com/)
    assert.equal((await findUserById(testDb, user.id))!.email, 'wants-it@example.com')
    assert.equal((await findUserById(testDb, owner.id))!.email, 'owner@example.com')

    // Taken between request and confirmation: the unique index fails the batch.
    let { code: freeCode } = await askToChange(cookie, 'free-now@example.com')
    await signIn('free-now@example.com')
    let raced = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: freeCode! }))
    assert.equal(raced.status, 422)
    assert.match(await raced.text(), /already has a Bits account/)
    assert.equal((await findUserById(testDb, user.id))!.email, 'wants-it@example.com')
  })

  it('keeps sign-in and email-change tokens apart', async () => {
    let { cookie } = await signIn('apart@example.com')
    let { code, token } = await askToChange(cookie, 'apart-new@example.com')
    // The change code can't sign anyone in as the new address...
    let signInWithIt = await fetchAs(null, routes.auth.verify.action.href(), post({ email: 'apart-new@example.com', code: code! }))
    assert.equal(signInWithIt.status, 422)
    assert.equal(await findUserByEmail(testDb, 'apart-new@example.com'), null)
    // ...and its link isn't a magic link.
    let magic = await fetchAs(null, routes.auth.verify.index.href(undefined, { searchParams: { token: token! } }))
    assert.equal(magic.headers.get('Location'), '/login?error=link-expired')
    // A sign-in code can't confirm a change.
    let signin = await requestCode('apart@example.com')
    let crossed = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: signin.code }))
    assert.equal(crossed.status, 422)
    let viaLink = await fetchAs(null, routes.auth.email.action.href(), post({ token: signin.token }))
    assert.equal(viaLink.headers.get('Location'), '/login?error=email-link-expired')
  })

  it('a new request replaces the last; five wrong codes lock it', async () => {
    let { cookie } = await signIn('retry@example.com')
    let first = await askToChange(cookie, 'retry-a@example.com')
    let second = await askToChange(cookie, 'retry-b@example.com')
    let stale = await fetchAs(null, routes.auth.email.index.href(undefined, { searchParams: { token: first.token! } }))
    assert.equal(stale.status, 303, 'the first link is withdrawn')
    let wrong = second.code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: wrong }))
    let locked = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: second.code! }))
    assert.equal(locked.status, 422)
    assert.match(await locked.text(), /expired or had too many tries/)
  })

  it('needs a signed-in user to ask', async () => {
    let response = await fetchAs(null, routes.settings.email.href(), post({ email: 'x@example.com' }))
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location')!, /^\/login/)
  })
})
