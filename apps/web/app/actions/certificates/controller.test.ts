import * as assert from 'remix/assert'
import { users } from '@bits/db'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../../routes.ts'
import { completeLesson, fetchAs, signIn, testDb } from '../../test/auth.ts'
import { plainCourse } from '../../test/plain-course.ts'

// The test-only fixture course: three lessons, no gated blocks, so a plain
// POST completes each one.
const COURSE = plainCourse.slug
const LESSONS = [...plainCourse.lessons]

async function page(cookie: string | null, path: string) {
  let response = await fetchAs(cookie, path)
  return { status: response.status, html: await response.text() }
}

async function finish(cookie: string, lessons = LESSONS) {
  for (let lesson of lessons) {
    let response = await completeLesson(cookie, COURSE, lesson)
    assert.equal(response.status, 303, `completing ${lesson}`)
  }
}

// One flat suite: remix test runs after() around every describe.
describe('certificates and the badge toast', () => {
  after(() => disposePlatform())

  it('exists only once every lesson is finished, and never shows the email or journal', async () => {
    let { cookie, user } = await signIn('cert-public@example.com', { displayName: 'Cert Holder' })
    let href = routes.certificates.show.href({ handle: user.handle, course: COURSE })

    await finish(cookie, LESSONS.slice(0, -1))
    assert.equal((await page(null, href)).status, 404, 'all but one lesson: no certificate')

    await finish(cookie, LESSONS.slice(-1))
    let { status, html } = await page(null, href)
    assert.equal(status, 200)
    assert.match(html, /Certificate of completion/)
    assert.match(html, /<h1[^>]*>.*Plain course<\/h1>/)
    assert.match(html, /Cert Holder/)
    assert.match(html, new RegExp(`@${user.handle}`))
    assert.match(html, /3 of 3/)
    assert.doesNotMatch(html, /cert-public@example\.com/)
    assert.doesNotMatch(html, /journal/i)
    // Shareable: a canonical-worthy page with a large preview card. The fixture
    // course has no card of its own (`pnpm og` never sees it), so it falls
    // back to the landing card, as any course without one does.
    assert.match(html, /<meta property="og:image" content="[^"]*\/og\/home\.png\?v=/)
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/)
    assert.doesNotMatch(html, /name="robots" content="noindex"/)
    // The holder and their progress come back in one batch (decision 035).
    let timed = await fetchAs(null, href)
    assert.match(timed.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="2 queries, 1 round trips"$/)
    await timed.text()

    // /me and the public profile link to it from the finished course row.
    let me = await page(cookie, routes.me.index.href())
    assert.match(me.html, new RegExp(`href="${href}"`))
    let profile = await page(null, routes.profile.index.href({ handle: user.handle }))
    assert.match(profile.html, new RegExp(`href="${href}"`))
  })

  it('answers the same 404 for unknown handles, courses and unfinished courses', async () => {
    let { user } = await signIn('cert-none@example.com')
    for (let path of [
      routes.certificates.show.href({ handle: 'nobody-here', course: COURSE }),
      routes.certificates.show.href({ handle: user.handle, course: 'no-such-course' }),
      routes.certificates.show.href({ handle: user.handle, course: COURSE }),
    ]) {
      let { status, html } = await page(null, path)
      assert.equal(status, 404, path)
      assert.match(html, /There’s no certificate here\./)
    }
  })

  it('follows profile privacy: hidden from others, visible (noindex) to its owner', async () => {
    let { cookie, user } = await signIn('cert-private@example.com')
    await finish(cookie)
    await testDb.update(users, user.id, { is_public: false })
    let href = routes.certificates.show.href({ handle: user.handle, course: COURSE })

    assert.equal((await page(null, href)).status, 404)
    let other = await signIn('cert-other@example.com')
    assert.equal((await page(other.cookie, href)).status, 404)

    let own = await page(cookie, href)
    assert.equal(own.status, 200)
    assert.match(own.html, /Only you can see this\./)
    assert.match(own.html, /name="robots" content="noindex"/)
    assert.doesNotMatch(own.html, /rel="canonical"/)
  })

  it('flashes newly earned badges once, on the page the completion lands on', async () => {
    let { cookie, user } = await signIn('toast@example.com')
    let first = await completeLesson(cookie, COURSE, LESSONS[0]!)
    assert.equal(first.status, 303)
    let next = first.headers.get('Location')!
    assert.equal(next, routes.courses.lesson.index.href({ course: COURSE, lesson: LESSONS[1]! }))

    let landed = await page(cookie, next)
    assert.match(landed.html, /data-badge-notice/)
    assert.match(landed.html, /role="status"/)
    assert.match(landed.html, /Badge earned: First token/)
    assert.match(landed.html, /See your badges →/)

    // Once only: a reload doesn't show it again.
    let again = await page(cookie, next)
    assert.doesNotMatch(again.html, /data-badge-notice/)

    // Completing a lesson that earns nothing new shows nothing.
    await completeLesson(cookie, COURSE, LESSONS[1]!)
    let quiet = await page(cookie, routes.courses.lesson.index.href({ course: COURSE, lesson: LESSONS[2]! }))
    assert.doesNotMatch(quiet.html, /data-badge-notice/)

    // The last lesson finishes the course: the toast lands on the course page
    // and links to the certificate.
    for (let lesson of LESSONS.slice(2, -1)) await completeLesson(cookie, COURSE, lesson)
    let last = await completeLesson(cookie, COURSE, LESSONS.at(-1)!)
    assert.equal(last.headers.get('Location'), routes.courses.course.index.href({ course: COURSE }))
    let course = await page(cookie, routes.courses.course.index.href({ course: COURSE }))
    assert.match(course.html, new RegExp(`Badge earned: ${plainCourse.badge}`))
    assert.match(course.html, /Your certificate is ready\./)
    assert.match(
      course.html,
      new RegExp(`href="${routes.certificates.show.href({ handle: user.handle, course: COURSE })}"`),
    )
  })

  it('shows no badge toast to signed-out learners (no badges without an account)', async () => {
    let response = await completeLesson(null, COURSE, LESSONS[0]!)
    assert.equal(response.status, 303)
    let cookie = response.headers.getSetCookie().find((c) => c.startsWith('__Host-session='))?.split(';')[0] ?? null
    let landed = await page(cookie, response.headers.get('Location')!)
    assert.doesNotMatch(landed.html, /data-badge-notice/)
  })
})
