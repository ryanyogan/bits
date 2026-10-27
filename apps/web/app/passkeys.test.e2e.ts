// End to end: passkeys in a real browser (decision 030). Chromium's CDP
// virtual authenticator stands in for Touch ID / Windows Hello, so the
// islands' real navigator.credentials calls run against the real router.
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { outbox } from './auth/mailer.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

// One flat suite: remix test runs after() around every describe.
describe('passkeys in the browser', () => {
  after(() => disposePlatform())

  it('adds a passkey in settings, then signs in with it', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    let cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    let { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    // WebAuthn refuses IP addresses as RP IDs: use the server by name.
    await page.goto(routes.health.href())
    let base = page.url().replace('127.0.0.1', 'localhost')
    let at = (path: string) => new URL(path, base).href

    // Sign in with email + code (a fresh sign-in, so adding a passkey is allowed).
    let email = `e2e-passkey-${Date.now()}@example.com`
    await page.goto(at(routes.login.index.href()))
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: /Email me a sign-in link/ }).click()
    await page.getByRole('button', { name: 'Verify & continue' }).waitFor()
    let code = /code is (\d{6})/.exec(outbox.findLast((m) => m.to === email)!.text)![1]!
    await page.getByLabel('Digit 1').fill(code)
    await page.waitForURL((url) => url.pathname === routes.courses.index.href())

    await page.goto(at(routes.settings.index.href()))
    // Without JS the key submits plainly ("needs JavaScript"): wait for the island.
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add a passkey' }).click()
    await page.getByText('Passkey added. Use it next time you sign in.').waitFor()
    let { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId })
    assert.equal(credentials.length, 1, 'the authenticator holds one discoverable credential')
    assert.equal(credentials[0]!.isResidentCredential, true)

    // Signed out, the passkey button signs straight back in (no email typed).
    await page.context().clearCookies()
    await page.goto(at(routes.login.index.href(undefined, { searchParams: { next: routes.settings.index.href() } })))
    // The virtual authenticator answers at once, so the conditional (autofill)
    // request may sign in before the button is clicked; either path is real.
    await page
      .getByRole('button', { name: 'Use a passkey' })
      .click({ timeout: 5000 })
      .catch(() => {})
    await page.waitForURL((url) => url.pathname === routes.settings.index.href())
    assert.ok((await page.content()).includes(email), 'signed in as the same account')
  })
})
