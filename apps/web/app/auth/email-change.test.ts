// Changing the sign-in email (decision 030): code and link confirmation,
// recent sign-in, uniqueness, and the old address's 7-day revert link.
import { findUserByEmail, findUserById, listPasskeys } from '@bits/db'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { ageSessions, fetchAs, form, requestCode, signIn, testDb, testIp } from '../test/auth.ts'
import { createSoftAuthenticator } from '../test/webauthn.ts'
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

function revertTokenFor(oldEmail: string): string {
  let notice = outbox.findLast((m) => m.to === oldEmail && /email was changed/.test(m.subject))!
  return /\/auth\/email\/revert\?token=([A-Za-z0-9_-]+)/.exec(notice.text)![1]!
}

// One flat suite: remix test runs after() around every describe.
describe('email change', () => {
  after(() => disposePlatform())

  it('confirms with the code: swaps the email, keeps sessions, mails the old address a revert link', async () => {
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
    assert.match(notice.text, /within 7 days/)
    assert.ok(revertTokenFor('move-me@example.com'))

    // Sessions stay until the old address objects (the revert link ends them).
    assert.equal((await fetchAs(cookie, routes.settings.index.href())).status, 200)
    assert.equal((await fetchAs(laptop, routes.settings.index.href())).status, 200)

    // The new address signs in to the same account.
    let again = await signIn('moved@example.com')
    assert.equal(again.user.id, user.id)
  })

  it('needs a recent sign-in to ask; a code to the current address or a passkey refreshes it', async () => {
    let { cookie, user } = await signIn('stale@example.com')
    await ageSessions(user.id)
    let page = await (await fetchAs(cookie, routes.settings.index.href())).text()
    assert.match(page, /To change your email, confirm it’s you first/)
    assert.match(page, /action="\/settings\/reauth"/)
    assert.doesNotMatch(page, /Send confirmation link/)

    let refused = await fetchAs(cookie, routes.settings.email.href(), post({ email: 'stale-new@example.com' }))
    assert.match(refused.headers.get('Location')!, /saved=reauth&for=email#email$/)
    assert.equal(outbox.findLast((m) => m.to === 'stale-new@example.com'), undefined, 'no mail to the new address')

    // Step-up by email: a sign-in code to the CURRENT address, back to settings.
    let reauth = await fetchAs(cookie, routes.settings.reauth.href(), post({}))
    assert.equal(reauth.status, 303)
    assert.match(reauth.headers.get('Location')!, /^\/login\/check\?email=stale%40example\.com&next=%2Fsettings/)
    let mail = outbox.findLast((m) => m.to === 'stale@example.com')!
    let code = /code is (\d{6})/.exec(mail.text)![1]!
    let verified = await fetchAs(cookie, routes.auth.verify.action.href(), post({ email: 'stale@example.com', code }))
    assert.equal(verified.headers.get('Location'), '/settings')
    let fresh = verified.headers.getSetCookie().find((c) => c.startsWith('__Host-session='))!.split(';')[0]!
    await askToChange(fresh, 'stale-new@example.com')
  })

  it('confirms with the link only from the account’s own session, and never signs anyone in', async () => {
    let { cookie, user } = await signIn('link-move@example.com')
    let { token } = await askToChange(cookie, 'link-moved@example.com')
    assert.ok(token)

    // Another device (or whoever got the link): told which account, asked to sign in.
    let page = await fetchAs(null, routes.auth.email.index.href(undefined, { searchParams: { token: token! } }))
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('Cache-Control'), 'no-store')
    let html = await page.text()
    assert.match(html, /Sign in first/)
    assert.match(html, /l\*\*\*@e\*\*\*\.com/, 'the account, masked')
    assert.doesNotMatch(html, /link-move@example\.com/, 'never the full address')
    let { cookie: stranger } = await signIn('stranger@example.com')
    for (let who of [null, stranger]) {
      let refused = await fetchAs(who, routes.auth.email.action.href(), post({ token: token! }))
      assert.equal(refused.status, 403)
      assert.equal(refused.headers.getSetCookie().length, 0, 'no session from a link')
    }
    assert.equal((await findUserById(testDb, user.id))!.email, 'link-move@example.com')

    // The account's own session: a confirm button, then the change.
    assert.match(
      await (await fetchAs(cookie, routes.auth.email.index.href(undefined, { searchParams: { token: token! } }))).text(),
      /Confirm new email/,
    )
    let confirmed = await fetchAs(cookie, routes.auth.email.action.href(), post({ token: token! }))
    assert.equal(confirmed.status, 303)
    assert.match(confirmed.headers.get('Location')!, /saved=email-changed/)
    assert.equal((await findUserById(testDb, user.id))!.email, 'link-moved@example.com')

    let reused = await fetchAs(cookie, routes.auth.email.action.href(), post({ token: token! }))
    assert.equal(reused.headers.get('Location'), '/login?error=email-link-expired')
  })

  it('the old address can undo it: email back, every session out, new passkeys gone', async () => {
    let { cookie, user } = await signIn('victim@example.com')
    // "The attacker" adds a passkey, then moves the email.
    let authenticator = await createSoftAuthenticator()
    let options = (await (
      await fetchAs(cookie, routes.api.passkey.href({ step: 'register-options' }), { method: 'POST' })
    ).json()) as PublicKeyCredentialCreationOptionsJSON
    await fetchAs(
      cookie,
      routes.settings.methods.href(),
      post({ intent: 'add-passkey', response: JSON.stringify(await authenticator.register(options)) }),
    )
    assert.equal((await listPasskeys(testDb, user.id)).length, 1)
    let { code } = await askToChange(cookie, 'attacker@example.com')
    await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: code! }))
    assert.equal((await findUserById(testDb, user.id))!.email, 'attacker@example.com')

    let token = revertTokenFor('victim@example.com')
    let page = await fetchAs(null, routes.auth.emailRevert.index.href(undefined, { searchParams: { token } }))
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Undo the change\?/)
    assert.equal((await findUserById(testDb, user.id))!.email, 'attacker@example.com', 'looking changes nothing')

    let undone = await fetchAs(null, routes.auth.emailRevert.action.href(), post({ token }))
    assert.equal(undone.status, 303)
    assert.equal(undone.headers.get('Location'), '/login?notice=email-reverted')
    assert.equal(undone.headers.getSetCookie().some((c) => /^__Host-session=[^;]+;/.test(c)), false, 'no session')
    assert.equal((await findUserById(testDb, user.id))!.email, 'victim@example.com')
    assert.equal((await fetchAs(cookie, routes.settings.index.href())).status, 303, 'every session is out')
    assert.equal((await listPasskeys(testDb, user.id)).length, 0)

    let twice = await fetchAs(null, routes.auth.emailRevert.action.href(), post({ token }))
    assert.equal(twice.headers.get('Location'), '/login?error=email-link-expired')
    // The victim signs in again with their own address.
    assert.equal((await signIn('victim@example.com')).user.id, user.id)
  })

  it('blocks another change while the revert window is open, so nobody can cancel the undo link', async () => {
    let { cookie, user } = await signIn('chain-a@example.com')
    let { code: toB } = await askToChange(cookie, 'chain-b@example.com')
    await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: toB! }))
    let revertAtoB = revertTokenFor('chain-a@example.com')

    // Whoever now holds B tries to move on to C (a fresh sign-in, so step-up passes).
    let attacker = (await signIn('chain-b@example.com')).cookie
    let blocked = await fetchAs(attacker, routes.settings.email.href(), post({ email: 'chain-c@example.com' }))
    assert.equal(blocked.status, 409)
    assert.match(await blocked.text(), /waiting for confirmation from your previous address\. Try again after \d+ \w+ \d{4}/)
    assert.equal(outbox.findLast((m) => m.to === 'chain-c@example.com'), undefined, 'no mail to C')
    assert.equal((await findUserById(testDb, user.id))!.email, 'chain-b@example.com')

    // A's undo link still works and ends the attacker's session.
    let undone = await fetchAs(null, routes.auth.emailRevert.action.href(), post({ token: revertAtoB }))
    assert.equal(undone.headers.get('Location'), '/login?notice=email-reverted')
    assert.equal((await findUserById(testDb, user.id))!.email, 'chain-a@example.com')
    assert.equal((await fetchAs(attacker, routes.settings.index.href())).status, 303)

    // Once the window is closed (here: the link is spent), changes work again.
    let owner = (await signIn('chain-a@example.com')).cookie
    await askToChange(owner, 'chain-d@example.com')
  })

  it('a revert link stops working once the account has moved on', async () => {
    let { cookie, user } = await signIn('drift-a@example.com')
    let { code } = await askToChange(cookie, 'drift-b@example.com')
    await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: code! }))
    let token = revertTokenFor('drift-a@example.com')
    // The email moves without a revert row (e.g. an admin fix): the link must not apply.
    await testDb.d1.prepare('update users set email = ? where id = ?').bind('drift-z@example.com', user.id).run()
    let refused = await fetchAs(null, routes.auth.emailRevert.action.href(), post({ token }))
    assert.equal(refused.headers.get('Location'), '/login?error=email-link-expired')
    assert.equal((await findUserById(testDb, user.id))!.email, 'drift-z@example.com')
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

  it('keeps sign-in, email-change and revert tokens apart', async () => {
    let { cookie } = await signIn('apart@example.com')
    let { code, token } = await askToChange(cookie, 'apart-new@example.com')
    // The change code can't sign anyone in as the new address...
    let signInWithIt = await fetchAs(null, routes.auth.verify.action.href(), post({ email: 'apart-new@example.com', code: code! }))
    assert.equal(signInWithIt.status, 422)
    assert.equal(await findUserByEmail(testDb, 'apart-new@example.com'), null)
    // ...its link isn't a magic link or a revert link.
    let magic = await fetchAs(null, routes.auth.verify.index.href(undefined, { searchParams: { token: token! } }))
    assert.equal(magic.headers.get('Location'), '/login?error=link-expired')
    let revert = await fetchAs(null, routes.auth.emailRevert.index.href(undefined, { searchParams: { token: token! } }))
    assert.equal(revert.headers.get('Location'), '/login?error=email-link-expired')
    // A sign-in code can't confirm a change.
    let signin = await requestCode('apart@example.com')
    let crossed = await fetchAs(cookie, routes.settings.emailConfirm.href(), post({ code: signin.code }))
    assert.equal(crossed.status, 422)
    let viaLink = await fetchAs(cookie, routes.auth.email.action.href(), post({ token: signin.token }))
    assert.equal(viaLink.headers.get('Location'), '/login?error=email-link-expired')
  })

  it('a new request replaces the last; five wrong codes lock it', async () => {
    let { cookie } = await signIn('retry@example.com')
    let first = await askToChange(cookie, 'retry-a@example.com')
    let second = await askToChange(cookie, 'retry-b@example.com')
    let stale = await fetchAs(cookie, routes.auth.email.index.href(undefined, { searchParams: { token: first.token! } }))
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
