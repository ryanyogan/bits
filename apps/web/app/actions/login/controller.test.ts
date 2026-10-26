import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { emailFailures } from './controller.tsx'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

function request(path: string, init?: RequestInit) {
  return router.fetch(new Request(new URL(path, 'http://localhost'), init))
}

function post(fields: Array<[string, string]>) {
  let body = new FormData()
  for (let [name, value] of fields) body.append(name, value)
  return { method: 'POST', body }
}

describe('/login', () => {
  it('renders sign in: title, one h1, tabs, passkey first, providers keep ?next', async () => {
    let response = await request(routes.login.index.href(undefined, { searchParams: { next: '/courses' } }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Sign in · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Welcome back\./)
    assert.match(html, /<nav aria-label="Account"/)
    assert.match(html, /href="\/login\?next=%2Fcourses" aria-current="page"/)
    // OAuth redirects leave the origin, so they are document navigations.
    assert.match(html, /href="\/auth\/oauth\/github\?next=%2Fcourses" data-rmx-document=""/)
    assert.match(html, /href="\/auth\/oauth\/google\?next=%2Fcourses" data-rmx-document=""/)
    assert.ok(html.indexOf('Use a passkey') < html.indexOf('Continue with GitHub'), 'passkey comes first')
    assert.match(html, /<input type="hidden" name="next" value="\/courses"/)
    assert.match(html, /<main id="main"/)
    assert.doesNotMatch(html, /name="goals"/)
  })

  it('answers every email failure with a 4xx page, which client navigation renders', () => {
    // The browser runtime rejects 5xx responses, so a re-render with a notice must be 4xx.
    for (let [reason, { status }] of Object.entries(emailFailures)) {
      assert.ok(status >= 400 && status < 500, `${reason}: ${status}`)
    }
  })

  it('renders create account with name, goal chips (curious on) and timezone', async () => {
    let html = await (await request(routes.login.index.href(undefined, { searchParams: { mode: 'signup' } }))).text()
    assert.match(html, /<title>Create account · Bits<\/title>/)
    assert.match(html, /Make it yours\./)
    assert.match(html, /name="displayName"/)
    assert.equal(html.match(/name="goals"/g)?.length, 4)
    assert.match(html, /name="goals" value="curious"[^>]*checked/)
    assert.match(html, /name="timezone"/)
    assert.match(html, /Create account →/)
  })

  it('re-renders sign-up errors with 422, keeping chosen goals', async () => {
    let response = await request(
      routes.login.action.href(),
      post([
        ['mode', 'signup'],
        ['email', 'nope'],
        ['displayName', 'Ada'],
        ['goals', 'code'],
        ['goals', 'teach'],
      ]),
    )
    assert.equal(response.status, 422)
    let html = await response.text()
    assert.match(html, /role="alert"/)
    assert.match(html, /Enter an email address like you@somewhere\.dev\./)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /name="goals" value="code"[^>]*checked/)
    assert.doesNotMatch(html, /name="goals" value="curious"[^>]*checked/)
  })

  it('carries signup mode to /login/check', async () => {
    let response = await request(
      routes.login.action.href(),
      post([
        ['mode', 'signup'],
        ['email', 'ada@example.com'],
        ['goals', 'work'],
        ['timezone', 'Europe/London'],
      ]),
    )
    assert.equal(response.status, 303)
    let location = new URL(response.headers.get('Location')!, 'http://localhost')
    assert.equal(location.searchParams.get('mode'), 'signup')
  })
})

describe('/login/check', () => {
  it('renders the check-inbox state with the code form, resend and change-email', async () => {
    let response = await request(
      routes.login.check.index.href(undefined, { searchParams: { email: 'ada@example.com', next: '/courses' } }),
    )
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
  })
})
