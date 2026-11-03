// The header's one primary action (decision 070): Start free for a new
// visitor, Continue once there is progress (signed in, or signed out with
// lessons done in the session), never Start free on a lesson page.
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { lessonOneHref } from '../actions/home/links.ts'
import { routes } from '../routes.ts'
import { completeLesson, fetchAs, sessionCookieFrom, signIn } from '../test/auth.ts'
import { plainCourse } from '../test/plain-course.ts'

/** The app bar's markup (the first `<header>`), and the page's whole HTML. */
async function page(cookie: string | null, path: string) {
  let response = await fetchAs(cookie, path)
  assert.equal(response.status, 200, path)
  let html = await response.text()
  let header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
  return { html, header }
}

const startFree = />Start free</
// `/continue`, or the next lesson itself on the landing, which already knows it.
const continueKey = /<a href="[^"]+"[^>]*>Continue</

/** A signed-out session with one lesson done, through the real complete form. */
async function signedOutWithProgress(): Promise<string> {
  let response = await completeLesson(null, plainCourse.slug, plainCourse.lessons[0])
  assert.equal(response.status, 303)
  let cookie = sessionCookieFrom(response)
  assert.ok(cookie, 'a signed-out completion starts a session')
  return cookie
}

describe('header primary action (decision 070)', () => {
  after(() => disposePlatform())

  it('offers a new visitor Start free, and nothing else, off lesson pages', async () => {
    for (let path of [routes.home.href(), routes.courses.index.href(), routes.legal.terms.href()]) {
      let { header } = await page(null, path)
      assert.match(header, startFree, path)
      assert.doesNotMatch(header, continueKey, path)
    }
  })

  it('never shows Start free on a lesson page, lesson 1 included', async () => {
    let lessonOne = await page(null, lessonOneHref())
    assert.doesNotMatch(lessonOne.header, startFree)
    assert.doesNotMatch(lessonOne.header, continueKey)
    let other = await page(null, routes.courses.lesson.index.href({ course: plainCourse.slug, lesson: plainCourse.lessons[1] }))
    assert.doesNotMatch(other.header, startFree)
  })

  it('swaps Start free for Continue once a signed-out session has progress', async () => {
    let cookie = await signedOutWithProgress()
    for (let path of [
      routes.home.href(),
      routes.courses.index.href(),
      routes.legal.terms.href(),
      routes.courses.lesson.index.href({ course: plainCourse.slug, lesson: plainCourse.lessons[1] }),
    ]) {
      let { header } = await page(cookie, path)
      assert.doesNotMatch(header, startFree, path)
      assert.match(header, continueKey, path)
    }
    // The landing opens on the next lesson too, as it does signed in.
    let { html } = await page(cookie, routes.home.href())
    assert.doesNotMatch(html, />Start lesson 1</)
    assert.match(html, /Continue lesson 2/)
    // And /continue takes the visitor there.
    let next = await fetchAs(cookie, routes.continue.href())
    assert.equal(next.status, 303)
    assert.equal(
      next.headers.get('Location'),
      routes.courses.lesson.index.href({ course: plainCourse.slug, lesson: plainCourse.lessons[1] }),
    )
  })

  it('shows a signed-in learner Continue everywhere, never Start free', async () => {
    let { cookie } = await signIn('header-actions@example.com')
    for (let path of [routes.home.href(), routes.courses.index.href(), routes.me.index.href(), lessonOneHref()]) {
      let { header } = await page(cookie, path)
      assert.doesNotMatch(header, startFree, path)
      assert.match(header, continueKey, path)
    }
  })

  it('uses one verb, Continue, for the catalog banner and the course rows', async () => {
    let cookie = await signedOutWithProgress()
    let { html } = await page(cookie, routes.courses.index.href())
    assert.doesNotMatch(html, /Resume/)
    assert.match(html, />Continue →</)
  })

  it('marks a passed but unsaved lesson apart from a saved one in the outline', async () => {
    let { html } = await page(null, lessonOneHref())
    // The open lesson's pass state says "not saved yet"; only saved lessons say "completed".
    assert.match(html, /<span class="sr-only">, passed, not saved yet<\/span>/)
    assert.doesNotMatch(html, /<span class="sr-only">, completed<\/span>/)
  })
})
