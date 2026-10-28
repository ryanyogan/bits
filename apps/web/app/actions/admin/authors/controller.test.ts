// /admin/authors and the invite link (decision 037).
import { findUserById, readMailQuota } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { outbox } from '../../../auth/mailer.ts'
import { routes } from '../../../routes.ts'
import { fetchAs, form, signIn, testDb, testIp } from '../../../test/auth.ts'

const COURSE = 'tokens-and-temperature'

const post = (cookie: string | null, path: string, fields: Record<string, string | string[]>) =>
  fetchAs(cookie, path, { method: 'POST', headers: { 'CF-Connecting-IP': testIp() }, body: form(fields) })

let adminSession: ReturnType<typeof signIn> | undefined
const admin = () => (adminSession ??= signIn('invites-admin@example.com', { role: 'admin' }))

/** Invites `email` as the admin and returns the link's token from the mail. */
async function invite(email: string, courses: string[] = []): Promise<string> {
  let { cookie } = await admin()
  let response = await post(cookie, routes.admin.authors.invite.href(), { email, courses })
  assert.equal(response.status, 303)
  assert.match(response.headers.get('Location')!, /saved=invited#invites$/)
  let message = outbox.findLast((m) => m.to === email)!
  assert.match(message.subject, /invited to write courses/)
  return /\/admin\/invite\?token=([A-Za-z0-9_-]+)/.exec(message.text)![1]!
}

const inviteHref = (token: string) => routes.admin.invite.index.href(undefined, { searchParams: { token } })
const accept = (cookie: string | null, token: string) => post(cookie, routes.admin.invite.action.href(), { token })

async function courseAuthors(userId: string): Promise<string[]> {
  let result = await testDb.d1.prepare('select course_slug from course_authors where user_id = ?').bind(userId).all<{ course_slug: string }>()
  return result.results.map((row) => row.course_slug)
}

// One flat suite: remix test runs after() around every describe.
describe('/admin/authors and author invites', () => {
  after(() => disposePlatform())

  it('is for admins only: signed out goes to sign-in, learners and authors get 403', async () => {
    let signedOut = await fetchAs(null, routes.admin.authors.index.href())
    assert.equal(signedOut.status, 303)
    assert.equal(signedOut.headers.get('Location'), '/login?next=%2Fadmin%2Fauthors')

    for (let role of ['learner', 'author'] as const) {
      let { cookie } = await signIn(`invites-${role}@example.com`, { role })
      let page = await fetchAs(cookie, routes.admin.authors.index.href())
      assert.equal(page.status, 403, role)
      assert.match(await page.text(), /This page is for bits admins/)
      // Every write checks the role too.
      let writes: Array<[string, Record<string, string>]> = [
        [routes.admin.authors.invite.href(), { email: 'x@example.com' }],
        [routes.admin.authors.role.href(), { user: 'someone', from: 'author' }],
        [routes.admin.authors.course.href(), { intent: 'add', course: COURSE, user: 'someone' }],
        [routes.admin.authors.revoke.href(), { invite: 'x' }],
      ]
      for (let [href, fields] of writes) {
        assert.equal((await post(cookie, href, fields)).status, 403, `${role} ${href}`)
      }
    }
  })

  it('lists authors, invites and courses in one batch after the session', async () => {
    let { cookie } = await admin()
    let response = await fetchAs(cookie, routes.admin.authors.index.href())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.match(response.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="5 queries, 2 round trips"$/)
    let html = await response.text()
    assert.match(html, /<title>Authors · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    for (let heading of ['Invite an author', 'Open invites', 'Authors and admins', 'Courses']) {
      assert.match(html, new RegExp(`>${heading}<`))
    }
    assert.match(html, new RegExp(`action="${routes.admin.authors.invite.href()}"`))
    assert.match(html, new RegExp(`name="courses" value="${COURSE}"`))
    assert.match(html, /invites-admin@example\.com/)

    // Linked from /author for admins only.
    let link = new RegExp(`href="${routes.admin.authors.index.href()}"`)
    assert.match(await (await fetchAs(cookie, routes.author.index.href())).text(), link)
    let { cookie: authorCookie } = await signIn('invites-author@example.com', { role: 'author' })
    assert.doesNotMatch(await (await fetchAs(authorCookie, routes.author.index.href())).text(), link)
  })

  it('re-renders an invalid address with 422 and focuses it', async () => {
    let { cookie } = await admin()
    let response = await post(cookie, routes.admin.authors.invite.href(), { email: 'not-an-email', courses: [COURSE] })
    assert.equal(response.status, 422)
    let html = await response.text()
    assert.match(html, /Enter an email address like you@somewhere\.dev\./)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /autofocus/i)
    assert.match(html, new RegExp(`value="${COURSE}"[^>]*checked`))
  })

  it('invite → accept as the invited address grants author and joins the course', async () => {
    let email = 'new-author@example.com'
    let token = await invite(email, [COURSE])

    // Listed as open on the admin page.
    let { cookie: adminCookie } = await admin()
    let listed = await (await fetchAs(adminCookie, routes.admin.authors.index.href())).text()
    assert.match(listed, /new-author@example\.com/)

    // Signed out: through sign-in and back.
    let signedOut = await fetchAs(null, inviteHref(token))
    assert.equal(signedOut.status, 303)
    let location = new URL(signedOut.headers.get('Location')!, 'http://localhost')
    assert.equal(location.pathname, '/login')
    assert.equal(location.searchParams.get('next'), inviteHref(token))

    // Signed in as someone else: told so, and the POST changes nothing.
    let { cookie: otherCookie, user: other } = await signIn('not-invited@example.com')
    let wrong = await fetchAs(otherCookie, inviteHref(token))
    assert.equal(wrong.status, 200)
    let wrongHtml = await wrong.text()
    assert.match(wrongHtml, /This invite is for someone else/)
    assert.match(wrongHtml, /n\*\*\*@e\*\*\*\.com/)
    assert.doesNotMatch(wrongHtml, /new-author@example\.com/)
    assert.equal((await accept(otherCookie, token)).status, 403)
    assert.equal((await findUserById(testDb, other.id))!.role, 'learner')

    // The invited address.
    let { cookie, user } = await signIn(email)
    let page = await fetchAs(cookie, inviteHref(token))
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('Referrer-Policy'), 'no-referrer')
    let html = await page.text()
    assert.match(html, /Write courses on bits\?/)
    let { user: inviter } = await admin()
    assert.match(html, new RegExp(`@${inviter.handle} invited you to be an author`))
    assert.match(html, /You’ll join <strong>[^<]*Temperature/i)
    // A GET never accepts.
    assert.equal((await findUserById(testDb, user.id))!.role, 'learner')

    let accepted = await accept(cookie, token)
    assert.equal(accepted.status, 303)
    assert.equal(accepted.headers.get('Location'), routes.author.index.href())
    assert.equal((await findUserById(testDb, user.id))!.role, 'author')
    assert.deepEqual(await courseAuthors(user.id), [COURSE])
    assert.equal((await fetchAs(cookie, routes.author.index.href())).status, 200)

    // Single use.
    assert.equal((await accept(cookie, token)).status, 410)
    assert.equal((await fetchAs(cookie, inviteHref(token))).status, 410)
  })

  it('never downgrades an admin who accepts', async () => {
    let email = 'second-admin@example.com'
    let { cookie, user } = await signIn(email, { role: 'admin' })
    let token = await invite(email, [COURSE])
    assert.equal((await accept(cookie, token)).status, 303)
    assert.equal((await findUserById(testDb, user.id))!.role, 'admin')
    assert.deepEqual(await courseAuthors(user.id), [COURSE])
  })

  it('refuses expired, withdrawn, replaced and made-up links', async () => {
    let { cookie: adminCookie } = await admin()
    let { cookie, user } = await signIn('late-author@example.com')

    let expired = await invite('late-author@example.com')
    await testDb.d1.prepare('update author_invites set expires_at = ? where email = ?').bind(Date.now() - 1, 'late-author@example.com').run()
    assert.equal((await fetchAs(cookie, inviteHref(expired))).status, 410)
    assert.equal((await accept(cookie, expired)).status, 410)

    let withdrawn = await invite('late-author@example.com')
    let row = await testDb.d1
      .prepare('select id from author_invites where email = ? and revoked_at is null and expires_at > ?')
      .bind('late-author@example.com', Date.now())
      .first<{ id: string }>()
    let revoked = await post(adminCookie, routes.admin.authors.revoke.href(), { invite: row!.id })
    assert.equal(revoked.status, 303)
    assert.match(revoked.headers.get('Location')!, /saved=revoked#invites$/)
    assert.equal((await accept(cookie, withdrawn)).status, 410)
    // Withdrawing it again is a 422 re-render.
    assert.equal((await post(adminCookie, routes.admin.authors.revoke.href(), { invite: row!.id })).status, 422)

    // A newer invite replaces the older link.
    let older = await invite('late-author@example.com')
    let newer = await invite('late-author@example.com')
    assert.equal((await accept(cookie, older)).status, 410)

    assert.equal((await fetchAs(cookie, inviteHref('made-up'))).status, 410)
    assert.equal((await fetchAs(cookie, inviteHref('A'.repeat(43)))).status, 410)
    assert.equal((await findUserById(testDb, user.id))!.role, 'learner')

    assert.equal((await accept(cookie, newer)).status, 303)
    assert.equal((await findUserById(testDb, user.id))!.role, 'author')
  })

  it('steps people down, never the acting admin', async () => {
    let { cookie, user: me } = await admin()
    let self = await post(cookie, routes.admin.authors.role.href(), { user: me.id, from: 'admin' })
    assert.equal(self.status, 422)
    assert.match(await self.text(), /You can’t remove your own admin role/)
    assert.equal((await findUserById(testDb, me.id))!.role, 'admin')

    let { user: author } = await signIn('step-down-author@example.com', { role: 'author' })
    await testDb.d1.prepare('insert into course_authors (course_slug, user_id, created_at) values (?, ?, 1)').bind(COURSE, author.id).run()
    let removed = await post(cookie, routes.admin.authors.role.href(), { user: author.id, from: 'author' })
    assert.equal(removed.status, 303)
    assert.match(removed.headers.get('Location')!, /saved=author-removed#people$/)
    assert.equal((await findUserById(testDb, author.id))!.role, 'learner')
    assert.deepEqual(await courseAuthors(author.id), [])
    // Already done: a stale form re-renders.
    assert.equal((await post(cookie, routes.admin.authors.role.href(), { user: author.id, from: 'author' })).status, 422)

    let { user: other } = await signIn('step-down-admin@example.com', { role: 'admin' })
    assert.equal((await post(cookie, routes.admin.authors.role.href(), { user: other.id, from: 'admin' })).status, 303)
    assert.equal((await findUserById(testDb, other.id))!.role, 'author')
  })

  it('adds and removes authors on a course', async () => {
    let { cookie } = await admin()
    let { user: author } = await signIn('course-author@example.com', { role: 'author' })
    let { user: learner } = await signIn('course-learner@example.com')

    let added = await post(cookie, routes.admin.authors.course.href(), { intent: 'add', course: COURSE, user: author.id })
    assert.equal(added.status, 303)
    assert.match(added.headers.get('Location')!, /saved=course-added#courses$/)
    assert.deepEqual(await courseAuthors(author.id), [COURSE])

    let refused = await post(cookie, routes.admin.authors.course.href(), { intent: 'add', course: COURSE, user: learner.id })
    assert.equal(refused.status, 422)
    assert.match(await refused.text(), /aren’t an author/)
    assert.deepEqual(await courseAuthors(learner.id), [])

    let removed = await post(cookie, routes.admin.authors.course.href(), { intent: 'remove', course: COURSE, user: author.id })
    assert.equal(removed.status, 303)
    assert.deepEqual(await courseAuthors(author.id), [])
  })

  it('takes a slot under the daily mail cap, and stores nothing once it is reached (decision 039)', async () => {
    let { cookie } = await admin()
    let email = 'capped-invitee@example.com'
    let before = (await readMailQuota(testDb, Date.now()))?.sent ?? 0
    await invite(email)
    assert.equal((await readMailQuota(testDb, Date.now()))?.sent, before + 1)

    let env = platform.env as { SIGNIN_MAIL_DAILY_CAP?: string }
    let saved = env.SIGNIN_MAIL_DAILY_CAP
    let original = console.error
    env.SIGNIN_MAIL_DAILY_CAP = String(before + 1)
    console.error = () => {}
    try {
      let mails = outbox.length
      let refused = await post(cookie, routes.admin.authors.invite.href(), { email })
      assert.equal(refused.status, 429)
      assert.match(await refused.text(), /sent all the email we can for today/)
      assert.equal(outbox.length, mails)
    } finally {
      env.SIGNIN_MAIL_DAILY_CAP = saved
      console.error = original
    }
    // The refused invite stored nothing and withdrew nothing: the first one is still the open one.
    let open = await testDb.d1
      .prepare('select count(*) as n from author_invites where email = ? and revoked_at is null')
      .bind(email)
      .first<{ n: number }>()
    assert.equal(open?.n, 1)
  })
})
