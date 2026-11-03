import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { emailFailures } from './controller.tsx'
import { routes } from '../../routes.ts'
import { sessionCookieFrom } from '../../test/auth.ts'

function request(path: string, init?: RequestInit) {
  return router.fetch(new Request(new URL(path, 'http://localhost'), init))
}

function post(fields: Array<[string, string]>) {
  let body = new FormData()
  for (let [name, value] of fields) body.append(name, value)
  return { method: 'POST', body }
}

// One flat suite: remix test runs after() around every describe.
describe('/login', () => {
  after(() => disposePlatform())

  it('renders the one header (decision 059): the app nav, no account actions', async () => {
    let html = await (await request(routes.login.index.href())).text()
    let header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    assert.equal(html.match(/<header[\s>]/g)?.length, 1, 'one banner')
    assert.match(header, /<nav aria-label="Primary"/)
    assert.match(header, /href="\/courses"[^>]*>Courses<\/a>/)
    // Signed out, My learning is only a sign-in wall, so the nav leaves it out (decision 065).
    assert.doesNotMatch(header, />My learning</)
    // This page is the way in: no Sign in / Start free in the bar or the sheet.
    assert.doesNotMatch(header, />Sign in<|>Start free</)
  })

  it('renders one passwordless flow: no tabs, passkey first, only configured providers (decision 065)', async () => {
    let response = await request(routes.login.index.href(undefined, { searchParams: { next: '/courses' } }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Sign in · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Sign in or sign up\./)
    assert.doesNotMatch(html, /<nav aria-label="Account"/)
    assert.doesNotMatch(html, /Create account/)
    assert.match(html, /Use a passkey/)
    // Tests run without OAuth credentials: no dead-end provider buttons.
    assert.doesNotMatch(html, /Continue with GitHub|Continue with Google/)
    assert.match(html, /<input type="hidden" name="next" value="\/courses"/)
    assert.match(html, /name="timezone"/)
    assert.match(html, /Email me a sign-in link →/)
    assert.match(html, /<main id="main"/)
    assert.doesNotMatch(html, /name="goals"|name="displayName"|name="mode"/)
    // Decision 044: one home link (the logo), a keyed email slot, real legal links.
    assert.equal(html.match(/href="\/"/g)?.length, 1, 'one logo, linking home')
    assert.match(html, /data-rmx-key="email"/)
    assert.match(html, /href="\/terms" data-rmx-prefetch="intent"/)
    assert.match(html, /href="\/privacy" data-rmx-prefetch="intent"/)
    assert.doesNotMatch(html, /href="#terms"/)
  })

  it('opens the same flow for an old ?mode=signup link', async () => {
    let html = await (await request(routes.login.index.href(undefined, { searchParams: { mode: 'signup' } }))).text()
    assert.match(html, /Sign in or sign up\./)
    assert.doesNotMatch(html, /Use a passkey.*Create account/s)
  })

  it('answers every email failure with a 4xx page, which client navigation renders', () => {
    // The browser runtime rejects 5xx responses, so a re-render with a notice must be 4xx.
    for (let [reason, { status }] of Object.entries(emailFailures)) {
      assert.ok(status >= 400 && status < 500, `${reason}: ${status}`)
    }
  })

  it('re-renders an invalid email with 422 and the issue', async () => {
    let response = await request(routes.login.action.href(), post([['email', 'nope']]))
    assert.equal(response.status, 422)
    let html = await response.text()
    assert.match(html, /role="alert"/)
    assert.match(html, /Enter an email address like you@somewhere\.dev\./)
    assert.match(html, /aria-invalid="true"/)
  })

  it('sends the address to /login/check through the session, never the URL (decision 065)', async () => {
    let response = await request(
      routes.login.action.href(),
      post([
        ['email', 'ada-check@example.com'],
        ['timezone', 'Europe/London'],
        ['next', '/courses'],
      ]),
    )
    assert.equal(response.status, 303)
    let location = response.headers.get('Location')!
    assert.doesNotMatch(location, /email|ada-check/)
    assert.equal(location, '/login/check?next=%2Fcourses')
    let cookie = sessionCookieFrom(response)
    assert.ok(cookie, 'a session holds the address')
    let check = await request(location, { headers: { Cookie: cookie! } })
    assert.equal(check.status, 200)
    let html = await check.text()
    assert.match(html, /ada-check@example\.com/)
    assert.match(html, /<input type="hidden" name="email" value="ada-check@example.com"/)
  })

  it('/login/check without an address in the session, goes back to /login', async () => {
    let response = await request(routes.login.check.index.href(undefined, { searchParams: { email: 'ada@example.com', next: '/courses' } }))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/login?next=%2Fcourses')
  })

  it('/login/check renders the check-inbox state with the code form, resend and change-email', async () => {
    let sent = await request(routes.login.action.href(), post([['email', 'ada@example.com'], ['next', '/courses']]))
    let response = await request(sent.headers.get('Location')!, { headers: { Cookie: sessionCookieFrom(sent)! } })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Check your inbox · Bits<\/title>/)
    assert.match(html, /Check your inbox\./)
    assert.match(html, /ada@example\.com/)
    assert.match(html, /action="\/auth\/verify"/)
    assert.match(html, /autocomplete="one-time-code"/)
    assert.match(html, /Verify &amp; continue/)
    assert.match(html, /Send again/)
    assert.match(html, /href="\/login\?next=%2Fcourses"[^>]*>Use another email/)
    assert.doesNotMatch(html, /<nav aria-label="Account"/)
  })
})
