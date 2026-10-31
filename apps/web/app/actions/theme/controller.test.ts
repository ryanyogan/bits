// The theme preference (decision 062): `POST /theme`, what it stores, and how
// the server renders the choice. The browser side is app/theme.test.e2e.ts.
import { findUserById, saveTheme, users } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'
import { fetchAs, form, requestCode, sessionCookieFrom, signIn, testDb } from '../../test/auth.ts'

const home = routes.home.href()
const themeHref = routes.theme.action.href()
const pinnedOn = (html: string) => /<html[^>]*data-theme="(\w+)"/.exec(html)?.[1] ?? null

const pick = (cookie: string | null, theme: string, init: RequestInit = {}) =>
  fetchAs(cookie, themeHref, { method: 'POST', body: form({ theme }), ...init })

/** Picks a theme signed out; returns the new session's cookie. */
async function anonymousPick(theme: string): Promise<string> {
  let response = await pick(null, theme)
  assert.equal(response.status, 303)
  return sessionCookieFrom(response)!
}

async function themeOf(userId: string) {
  return (await findUserById(testDb, userId))?.theme ?? null
}

/** Signs in on the session `cookie` already holds, as a learner who picked a theme first would. */
async function signInOn(cookie: string, email: string): Promise<string> {
  let { code } = await requestCode(email)
  let response = await fetchAs(cookie, routes.auth.verify.action.href(), { method: 'POST', body: form({ email, code }) })
  assert.equal(response.status, 303)
  return sessionCookieFrom(response) ?? cookie
}

// One flat suite: remix test runs after() around every describe.
describe('the theme preference (decision 062)', () => {
  after(() => disposePlatform())

  it('POST /theme signed out saves to the session and answers 303 to the landing', async () => {
    let response = await pick(null, 'light')
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/')
    let cookie = sessionCookieFrom(response)
    assert.ok(cookie, 'the session was written')
    let html = await (await fetchAs(cookie, home)).text()
    assert.equal(pinnedOn(html), 'light')
    assert.match(html, /name="color-scheme" content="light"/)
    assert.match(html, /<button[^>]*value="light"[^>]*aria-pressed="true"/)
    assert.match(html, /<button[^>]*value="dark"[^>]*aria-pressed="false"/)
  })

  it('POST /theme signed in saves to users.theme, and system clears it', async () => {
    let { cookie, user } = await signIn('theme-post@example.com')
    assert.equal((await pick(cookie, 'dark')).status, 303)
    assert.equal(await themeOf(user.id), 'dark')
    assert.equal(pinnedOn(await (await fetchAs(cookie, home)).text()), 'dark')

    assert.equal((await pick(cookie, 'system')).status, 303)
    assert.equal(await themeOf(user.id), null)
    assert.equal(pinnedOn(await (await fetchAs(cookie, home)).text()), null)
  })

  it('never takes the redirect target from the request', async () => {
    let response = await fetchAs(null, `${themeHref}?next=https://evil.example/&redirect=//evil.example`, {
      method: 'POST',
      body: form({ theme: 'dark', next: '//evil.example/', redirect: 'https://evil.example/' }),
      headers: { Referer: 'https://evil.example/' },
    })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/')
  })

  it('an invalid or missing value is a 422 page and saves nothing', async () => {
    let { cookie, user } = await signIn('theme-invalid@example.com')
    for (let body of [form({ theme: 'sepia' }), form({})]) {
      let response = await fetchAs(cookie, themeHref, { method: 'POST', body })
      assert.equal(response.status, 422)
      assert.match(await response.text(), /That isn't a theme|That isn&#x27;t a theme|That isn&#39;t a theme/)
    }
    assert.equal(await themeOf(user.id), null)

    let anonymous = await pick(null, 'sepia')
    assert.equal(anonymous.status, 422)
    assert.equal(anonymous.headers.get('Set-Cookie'), null, 'no session for a refused pick')
  })

  it('refuses a cross-origin POST before it saves', async () => {
    let { cookie, user } = await signIn('theme-cop@example.com')
    let refused: Record<string, string>[] = [{ 'Sec-Fetch-Site': 'cross-site' }, { Origin: 'https://evil.example' }]
    for (let headers of refused) {
      let response = await pick(cookie, 'light', { headers })
      assert.equal(response.status, 403)
    }
    assert.equal(await themeOf(user.id), null)
  })

  it('POST /theme past the burst limit is a 429 and saves nothing', async () => {
    let env = platform.env as unknown as Record<string, unknown>
    env.RL_WRITES = { limit: async () => ({ success: false }) }
    try {
      let { cookie, user } = await signIn('theme-limit@example.com')
      let response = await pick(cookie, 'light')
      assert.equal(response.status, 429)
      assert.equal(response.headers.get('Retry-After'), '60')
      assert.equal(await themeOf(user.id), null)
    } finally {
      env.RL_WRITES = undefined
    }
  })

  it('a GET with ?theme= changes nothing and does not redirect, on any route', async () => {
    let { cookie, user } = await signIn('theme-get@example.com')
    let cases: [string, number][] = [
      ['/?theme=dark', 200],
      ['/courses?theme=light', 200],
      ['/terms?theme=dark', 200],
      ['/no-such-page?theme=dark', 404],
      [`${themeHref}?theme=dark`, 404],
    ]
    for (let [href, status] of cases) {
      let response = await fetchAs(null, href)
      assert.equal(response.status, status, href)
      assert.equal(response.headers.get('Location'), null, href)
      assert.equal(response.headers.get('Set-Cookie'), null, `${href}: no session`)
      assert.equal(pinnedOn(await response.text()), null, href)
    }

    let settings = await fetchAs(cookie, `${routes.settings.index.href()}?theme=light`)
    assert.equal(settings.status, 200)
    await settings.text()
    assert.equal(await themeOf(user.id), null)

    // The old path trick: nothing about this request can name another origin.
    let trick = await router.fetch(new Request('http://localhost//evil.com/?theme=dark'))
    assert.ok(!/evil\.com/.test(trick.headers.get('Location') ?? ''), 'no redirect off the origin')
    await trick.text()
    // A guard page keeps redirecting to sign-in, without saving.
    let guarded = await fetchAs(null, `${routes.settings.index.href()}?theme=dark`)
    assert.equal(guarded.status, 303)
    assert.equal(guarded.headers.get('Set-Cookie')?.includes('theme'), undefined)
  })

  it('renders from the user column, then the session, then the system', async () => {
    let cookie = await anonymousPick('light')
    let signedIn = await signInOn(cookie, 'theme-order@example.com')
    let user = (await testDb.findOne(users, { where: { email: 'theme-order@example.com' } }))!

    // Deliberately no merge: like lesson_depth, the account stays unset and
    // the session keeps the choice until the account has one of its own.
    assert.equal(await themeOf(user.id), null, 'not copied at sign-in')
    assert.equal(pinnedOn(await (await fetchAs(signedIn, home)).text()), 'light', 'session, when the column is null')

    await saveTheme(testDb, user.id, 'dark')
    assert.equal(pinnedOn(await (await fetchAs(signedIn, home)).text()), 'dark', 'the column beats the session')
  })

  it('picking system signed in drops a stale session value', async () => {
    let cookie = await anonymousPick('light')
    let signedIn = await signInOn(cookie, 'theme-stale@example.com')
    let response = await pick(signedIn, 'system')
    assert.equal(response.status, 303)
    assert.equal(pinnedOn(await (await fetchAs(signedIn, home)).text()), null, 'no fallback to the old pick')
  })

  it('picking system signed out clears the pick, and writes nothing when there was none', async () => {
    let cookie = await anonymousPick('dark')
    assert.equal((await pick(cookie, 'system')).status, 303)
    assert.equal(pinnedOn(await (await fetchAs(cookie, home)).text()), null)

    let fresh = await pick(null, 'system')
    assert.equal(fresh.status, 303)
    assert.equal(fresh.headers.get('Set-Cookie'), null, 'no session write for no choice')
  })

  it('anonymous pages get no session from this code', async () => {
    for (let href of [home, routes.courses.index.href(), '/no-such-page']) {
      let response = await fetchAs(null, href)
      assert.equal(response.headers.get('Set-Cookie'), null, href)
      await response.text()
    }
  })

  it('a pinned page stays private and uncached, and has no validators', async () => {
    let cookie = await anonymousPick('light')
    let response = await fetchAs(cookie, home)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-cache')
    assert.equal(response.headers.get('ETag'), null)
    await response.text()
  })

  it('status pages render in the pinned theme', async () => {
    let cookie = await anonymousPick('light')
    let notFound = await fetchAs(cookie, '/no-such-page')
    assert.equal(notFound.status, 404)
    assert.equal(pinnedOn(await notFound.text()), 'light')

    let invalid = await pick(cookie, 'sepia')
    assert.equal(invalid.status, 422)
    assert.equal(pinnedOn(await invalid.text()), 'light')

    let env = platform.env as unknown as Record<string, unknown>
    env.RL_WRITES = { limit: async () => ({ success: false }) }
    try {
      let limited = await pick(cookie, 'dark')
      assert.equal(limited.status, 429)
      assert.equal(pinnedOn(await limited.text()), 'light')
    } finally {
      env.RL_WRITES = undefined
    }
  })

  it('adds no D1 read: the column comes with the session read', async () => {
    let { cookie, user } = await signIn('theme-timing@example.com')
    let timing = async (href: string) => (await fetchAs(cookie, href)).headers.get('Server-Timing') ?? ''
    let before = /desc="[^"]*"/.exec(await timing(home))?.[0]
    assert.equal(before, 'desc="1 queries, 1 round trips"')
    await saveTheme(testDb, user.id, 'light')
    assert.equal(/desc="[^"]*"/.exec(await timing(home))?.[0], before, 'a pinned theme costs nothing')

    // /me joins its profile rows to the session read; the column still comes along.
    let me = await fetchAs(cookie, routes.me.index.href())
    assert.match(me.headers.get('Server-Timing') ?? '', /1 round trips/)
    assert.equal(pinnedOn(await me.text()), 'light')
    // A lesson-area GET brings completed lessons with it.
    let courses = await fetchAs(cookie, routes.courses.index.href())
    assert.match(courses.headers.get('Server-Timing') ?? '', /1 round trips/)
    assert.equal(pinnedOn(await courses.text()), 'light')
  })

  it('Settings shows the saved value without JS, saves, and exports it', async () => {
    let { cookie, user } = await signIn('theme-settings@example.com')
    let checked = async () =>
      /name="theme" value="(\w+)"[^>]*checked/.exec(await (await fetchAs(cookie, routes.settings.index.href())).text())?.[1]
    assert.equal(await checked(), 'system')

    let saved = await fetchAs(cookie, routes.settings.appearance.href(), { method: 'POST', body: form({ theme: 'light' }) })
    assert.equal(saved.status, 303)
    assert.equal(await themeOf(user.id), 'light')
    assert.equal(await checked(), 'light')
    let page = await (await fetchAs(cookie, saved.headers.get('Location')!)).text()
    assert.match(page, /Every page uses this theme now/)

    let bad = await fetchAs(cookie, routes.settings.appearance.href(), { method: 'POST', body: form({ theme: 'sepia' }) })
    assert.equal(bad.status, 303)
    assert.equal(await themeOf(user.id), 'light', 'unchanged')
    assert.match(await (await fetchAs(cookie, bad.headers.get('Location')!)).text(), /Pick System, Dark or Light\./)

    let exported = await (await fetchAs(cookie, routes.settings.export.href())).json()
    assert.equal(JSON.stringify(exported).includes('"theme":"light"'), true)
  })

  it('the footer switch is a native POST form that never prefetches', async () => {
    let html = await (await fetchAs(null, home)).text()
    let switchForm = /<form[^>]*aria-label="Theme"[^>]*>.*?<\/form>/s.exec(html)?.[0] ?? ''
    assert.match(switchForm, /method="post"/)
    assert.match(switchForm, /action="\/theme"/)
    assert.equal(switchForm.match(/<button/g)?.length, 3)
    assert.ok(!switchForm.includes('data-rmx-prefetch'))
    assert.ok(!html.includes('?theme='), 'no theme link left')
    assert.match(switchForm, /value="system"[^>]*aria-pressed="true"/)
  })
})
