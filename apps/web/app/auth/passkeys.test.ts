// Passkeys end to end through the router (decision 030): options from
// /api/passkey/*, a software authenticator answering them, and the native
// form POSTs that verify. The verifier is the real @simplewebauthn/server.
import { findUserByEmail, listPasskeys } from '@bits/db'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { ageSessions, fetchAs, form, sessionCookieFrom, signIn, testDb } from '../test/auth.ts'
import { createSoftAuthenticator, type SoftAuthenticator } from '../test/webauthn.ts'

const post = (fields: Record<string, string>) => ({ method: 'POST', body: form(fields) })

async function registerOptions(cookie: string | null): Promise<Response> {
  return fetchAs(cookie, routes.api.passkey.href({ step: 'register-options' }), { method: 'POST' })
}

async function loginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  let response = await fetchAs(null, routes.api.passkey.href({ step: 'login-options' }), { method: 'POST' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  return response.json()
}

async function addPasskey(cookie: string, authenticator: SoftAuthenticator): Promise<Response> {
  let options = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
  let response = await authenticator.register(options)
  return fetchAs(
    cookie,
    routes.settings.methods.href(),
    post({ intent: 'add-passkey', response: JSON.stringify(response) }),
  )
}

function passkeySignIn(response: unknown, next?: string): Promise<Response> {
  return fetchAs(
    null,
    routes.login.passkey.href(),
    post({ response: JSON.stringify(response), ...(next ? { next } : {}) }),
  )
}

// One flat suite: remix test runs after() around every describe.
describe('passkeys', () => {
  after(() => disposePlatform())

  it('registration options need a signed-in user', async () => {
    let response = await registerOptions(null)
    assert.equal(response.status, 401)
    assert.equal((await fetchAs(null, routes.api.passkey.href({ step: 'nope' }), { method: 'POST' })).status, 404)
  })

  it('registers a passkey from settings and lists it', async () => {
    let { cookie, user } = await signIn('pk-add@example.com', { displayName: 'Pat Key' })
    let options = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
    assert.equal(options.rp.id, 'localhost')
    assert.equal(options.user.name, 'pk-add@example.com')
    assert.equal(options.authenticatorSelection?.residentKey, 'required')
    assert.equal(options.authenticatorSelection?.userVerification, 'required')

    let authenticator = await createSoftAuthenticator()
    let registration = await authenticator.register(options)
    let saved = await fetchAs(
      cookie,
      routes.settings.methods.href(),
      { ...post({ intent: 'add-passkey', response: JSON.stringify(registration) }), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36' } },
    )
    assert.equal(saved.status, 303)
    assert.match(saved.headers.get('Location')!, /saved=passkey-added#sign-in$/)

    let rows = await listPasskeys(testDb, user.id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.credential_id, authenticator.credentialId)
    assert.equal(rows[0]!.name, 'Chrome on macOS')
    assert.equal(rows[0]!.backed_up, 1)

    let html = await (await fetchAs(cookie, routes.settings.index.href())).text()
    assert.match(html, /Chrome on macOS/)
    assert.match(html, /synced · added \d+ \w+ \d{4} · not used yet/)
    assert.match(html, /You have 1 passkey\./)

    // The same answer again: its challenge is spent.
    let replay = await fetchAs(
      cookie,
      routes.settings.methods.href(),
      post({ intent: 'add-passkey', response: JSON.stringify(registration) }),
    )
    assert.match(replay.headers.get('Location')!, /saved=passkey-failed/)
    // A second registration excludes the existing credential.
    let again = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
    assert.deepEqual(
      again.excludeCredentials?.map((credential) => credential.id),
      [authenticator.credentialId],
    )
  })

  it('adding a passkey needs a recent sign-in; signing in with a passkey refreshes it', async () => {
    let { cookie, user } = await signIn('pk-stale@example.com')
    let authenticator = await createSoftAuthenticator()
    // Register while fresh, so there is a passkey to step up with.
    assert.equal((await addPasskey(cookie, authenticator)).status, 303)
    let options = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
    await ageSessions(user.id)

    let refused = await registerOptions(cookie)
    assert.equal(refused.status, 403)
    assert.equal((await refused.json()).error, 'reauth_required')
    let second = await createSoftAuthenticator()
    let late = await fetchAs(
      cookie,
      routes.settings.methods.href(),
      post({ intent: 'add-passkey', response: JSON.stringify(await second.register(options)) }),
    )
    assert.match(late.headers.get('Location')!, /saved=reauth&for=passkey#sign-in$/)
    assert.equal((await listPasskeys(testDb, user.id)).length, 1)
    let page = await (await fetchAs(cookie, routes.settings.index.href())).text()
    assert.match(page, /To add a passkey or connect GitHub or Google, confirm it’s you first/)

    let stepUp = await passkeySignIn(await authenticator.authenticate(await loginOptions()), '/settings')
    let fresh = sessionCookieFrom(stepUp)!
    assert.equal((await registerOptions(fresh)).status, 200)
  })

  it('rejects a registration from another origin, without user verification, or for another user', async () => {
    let { cookie } = await signIn('pk-bad@example.com')
    let authenticator = await createSoftAuthenticator()
    let attempt = async (cookieFor: string, overrides: Parameters<SoftAuthenticator['register']>[1]) => {
      let options = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
      let response = await authenticator.register(options, overrides)
      let saved = await fetchAs(
        cookieFor,
        routes.settings.methods.href(),
        post({ intent: 'add-passkey', response: JSON.stringify(response) }),
      )
      return saved.headers.get('Location')!
    }
    assert.match(await attempt(cookie, { origin: 'https://evil.example' }), /saved=passkey-failed/)
    assert.match(await attempt(cookie, { userVerified: false }), /saved=passkey-failed/)
    // A challenge issued to pk-bad can't register a passkey on someone else's account.
    let { cookie: other, user: otherUser } = await signIn('pk-other@example.com')
    assert.match(await attempt(other, {}), /saved=passkey-failed/)
    assert.equal((await listPasskeys(testDb, otherUser.id)).length, 0)
    let garbage = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: 'add-passkey', response: '{nope' }))
    assert.match(garbage.headers.get('Location')!, /saved=passkey-failed/)
  })

  it('signs in with a passkey: rotates the session and follows next', async () => {
    let { cookie, user } = await signIn('pk-login@example.com')
    let authenticator = await createSoftAuthenticator()
    assert.equal((await addPasskey(cookie, authenticator)).status, 303)

    let options = await loginOptions()
    assert.equal(options.rpId, 'localhost')
    assert.equal(options.userVerification, 'required')
    assert.equal(options.allowCredentials?.length ?? 0, 0, 'discoverable: no allow-list, no email first')
    let assertion = await authenticator.authenticate(options)
    let response = await passkeySignIn(assertion, '/me')
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/me')
    let session = sessionCookieFrom(response)
    assert.ok(session, 'a new session cookie')

    let settings = await fetchAs(session, routes.settings.index.href())
    assert.equal(settings.status, 200)
    assert.match(await settings.text(), /pk-login@example\.com/)
    let [row] = await listPasskeys(testDb, user.id)
    assert.equal(row!.counter, 1)
    assert.ok(row!.last_used_at)

    // Replaying the same assertion fails: the challenge is spent.
    let replay = await passkeySignIn(assertion)
    assert.equal(replay.status, 422)
    assert.match(await replay.text(), /That passkey didn’t work/)
    assert.equal(sessionCookieFrom(replay), null)
  })

  it('refuses wrong origins, missing user verification, cross-purpose challenges and unknown passkeys', async () => {
    let { cookie } = await signIn('pk-refuse@example.com')
    let authenticator = await createSoftAuthenticator()
    await addPasskey(cookie, authenticator)

    let wrongOrigin = await passkeySignIn(await authenticator.authenticate(await loginOptions(), { origin: 'https://evil.example' }))
    assert.equal(wrongOrigin.status, 422)
    let noUv = await passkeySignIn(await authenticator.authenticate(await loginOptions(), { userVerified: false }))
    assert.equal(noUv.status, 422)

    // A registration challenge can't be used to sign in.
    let registration = (await (await registerOptions(cookie)).json()) as PublicKeyCredentialCreationOptionsJSON
    let crossed = await passkeySignIn(
      await authenticator.authenticate({ challenge: registration.challenge, rpId: 'localhost' }),
    )
    assert.equal(crossed.status, 422)

    // A credential this site doesn't know: 404, and the page asks the browser to forget it.
    let stranger = await createSoftAuthenticator()
    await stranger.register({
      challenge: 'x',
      rp: { id: 'localhost', name: 'Bits' },
      user: { id: 'dGVzdA', name: 't', displayName: 't' },
      pubKeyCredParams: [],
    })
    let unknown = await passkeySignIn(await stranger.authenticate(await loginOptions()))
    assert.equal(unknown.status, 404)
    let html = await unknown.text()
    assert.match(html, /That passkey isn’t on any Bits account/)
    assert.ok(html.includes(stranger.credentialId), 'unknownCredential prop for the Signal API')

    assert.equal((await passkeySignIn('not json')).status, 422)
  })

  it('renames and removes only your own passkeys', async () => {
    let { cookie, user } = await signIn('pk-manage@example.com')
    let authenticator = await createSoftAuthenticator()
    await addPasskey(cookie, authenticator)
    let id = authenticator.credentialId
    let { cookie: intruder } = await signIn('pk-intruder@example.com')

    let renamed = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: `rename:${id}`, name: '  Work laptop  ' }))
    assert.match(renamed.headers.get('Location')!, /saved=renamed/)
    assert.equal((await listPasskeys(testDb, user.id))[0]!.name, 'Work laptop')
    let blank = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: `rename:${id}`, name: '   ' }))
    assert.match(blank.headers.get('Location')!, /saved=passkey-name/)

    let hijack = await fetchAs(intruder, routes.settings.methods.href(), post({ intent: `remove:${id}` }))
    assert.match(hijack.headers.get('Location')!, /saved=methods-error/)
    let rename = await fetchAs(intruder, routes.settings.methods.href(), post({ intent: `rename:${id}`, name: 'Mine' }))
    assert.match(rename.headers.get('Location')!, /saved=methods-error/)
    assert.equal((await listPasskeys(testDb, user.id)).length, 1)

    let removed = await fetchAs(cookie, routes.settings.methods.href(), post({ intent: `remove:${id}` }))
    assert.match(removed.headers.get('Location')!, /saved=removed/)
    assert.equal((await listPasskeys(testDb, user.id)).length, 0)

    // A removed passkey no longer signs in.
    let after = await passkeySignIn(await authenticator.authenticate(await loginOptions()))
    assert.equal(after.status, 404)
  })

  it('deleting the account deletes its passkeys', async () => {
    let { cookie } = await signIn('pk-doomed@example.com', { displayName: 'Doomed Key' })
    let authenticator = await createSoftAuthenticator()
    await addPasskey(cookie, authenticator)
    let user = (await findUserByEmail(testDb, 'pk-doomed@example.com'))!
    await fetchAs(cookie, routes.settings.deleteAccount.href(), post({ confirm: user.handle }))
    assert.equal((await listPasskeys(testDb, user.id)).length, 0)
  })
})
