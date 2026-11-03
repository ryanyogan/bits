// Course and lesson metadata on the pages (decision 073): coming-soon
// courses, freshness dates, desk lessons, the start-from-tag line and the
// catalog order. Uses the fixtures in content/fixtures/soon-course and
// content/fixtures/build-along, which only the test platform publishes.
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { loadCatalog } from '../../content/store.ts'
import { badgeDefinitions } from '../../progress/badges.ts'
import { routes } from '../../routes.ts'
import { completeLesson, fetchAs, signIn, testDb } from '../../test/auth.ts'
import { buildAlongCourse, soonCourse } from '../../test/metadata-courses.ts'

async function page(path: string, cookie: string | null = null) {
  let response = await fetchAs(cookie, path)
  return { status: response.status, html: await response.text() }
}

const courseHref = (course: string) => routes.courses.course.index.href({ course })
const lessonHref = (course: string, lesson: string) => routes.courses.lesson.index.href({ course, lesson })

// One flat suite: remix test runs after() around every describe.
describe('course metadata (decision 073)', () => {
  after(() => disposePlatform())

  it('lists a coming-soon course with a Coming soon tag; its card opens the course page, never a lesson', async () => {
    let { html } = await page(routes.courses.index.href())
    let card = html.match(new RegExp(`<a href="${courseHref(soonCourse.slug)}"[\\s\\S]*?</a>`))?.[0] ?? ''
    assert.ok(card, 'the soon course has a card')
    assert.match(card, />Coming soon</)
    assert.doesNotMatch(html, new RegExp(`href="/courses/${soonCourse.slug}/`))
  })

  it('shows a soon course’s outline with no lesson links and no Start key', async () => {
    let { status, html } = await page(courseHref(soonCourse.slug))
    assert.equal(status, 200)
    assert.match(html, />Coming soon</)
    assert.match(html, /What it is/)
    assert.match(html, /Build it/)
    assert.doesNotMatch(html, new RegExp(`href="/courses/${soonCourse.slug}/`))
    assert.doesNotMatch(html, /Start the course/)
    assert.match(html, /Not open yet/)
  })

  it('answers a soon course’s lesson URLs with a 404 status page, and refuses to save them', async () => {
    let { status, html } = await page(lessonHref(soonCourse.slug, soonCourse.lessons[0]))
    assert.equal(status, 404)
    assert.match(html, /This lesson isn(?:'|&#39;)t open yet\./)
    assert.match(html, new RegExp(`<a href="${courseHref(soonCourse.slug)}">Its course page</a>`))
    let { cookie } = await signIn('soon-saver@example.com')
    let saved = await completeLesson(cookie, soonCourse.slug, soonCourse.lessons[0])
    assert.equal(saved.status, 404)
  })

  it('keeps a soon course out of the sitemap, the badges and certificates', async () => {
    let xml = await (await fetchAs(null, routes.sitemap.href())).text()
    assert.doesNotMatch(xml, new RegExp(`/courses/${soonCourse.slug}`))
    assert.match(xml, new RegExp(`/courses/${buildAlongCourse.slug}/${buildAlongCourse.build}<`))
    let catalog = await loadCatalog(testDb, platform.env.CONTENT)
    let ids = badgeDefinitions(catalog).map((badge) => badge.id)
    assert.ok(!ids.includes(`course:${soonCourse.slug}`))
    assert.ok(ids.includes(`course:${buildAlongCourse.slug}`))
    let { cookie, user } = await signIn('soon-cert@example.com')
    let certificate = await page(routes.certificates.show.href({ handle: user.handle, course: soonCourse.slug }), cookie)
    assert.equal(certificate.status, 404)
  })

  it('orders the catalog by course.md order: the concept courses, then the build-along sequence', async () => {
    let { html } = await page(routes.courses.index.href())
    let order = [...html.matchAll(/<a href="\/courses\/([a-z0-9-]+)"[^>]*data-rmx-prefetch/g)].map((m) => m[1])
    let expected = [
      'what-is-an-llm',
      'tokens-and-temperature',
      'prompting-that-works',
      'context-is-everything',
      'give-your-model-tools',
      'first-agent-loop',
      'retrieval-without-tears',
      'ship-an-agent-to-the-edge',
    ]
    assert.deepEqual(
      order.filter((slug) => expected.includes(slug!)),
      expected,
    )
  })

  it('draws the freshness line and the start-from-tag sample on a build lesson', async () => {
    let { status, html } = await page(lessonHref(buildAlongCourse.slug, buildAlongCourse.build))
    assert.equal(status, 200)
    assert.match(html, /Verified <time datetime="2026-11-01">1 Nov 2026<\/time>/)
    assert.match(html, />agents<\/span> 0\.33\.1/)
    assert.match(html, />wrangler<\/span> 4\.45\.2/)
    // GitHub is another origin: a document load, never prefetched.
    let link = html.match(/<a href="https:\/\/github\.com\/ryanyogan\/klippy\/tree\/a-01"[^>]*>/)?.[0] ?? ''
    assert.ok(link, 'links the tag on GitHub')
    assert.match(link, /data-rmx-document/)
    assert.doesNotMatch(link, /data-rmx-prefetch/)
    assert.match(html, /git clone[\s\S]*?https:\/\/github\.com\/ryanyogan\/klippy/)
    assert.match(html, /git checkout[\s\S]*?a-01/)
  })

  it('tags a desk lesson in the lesson bar and the course outline, with the reason for screen readers', async () => {
    let lesson = await page(lessonHref(buildAlongCourse.slug, buildAlongCourse.build))
    assert.match(lesson.html, /Desk<span class="sr-only">: best at a computer, with a terminal<\/span>/)
    let idea = await page(lessonHref(buildAlongCourse.slug, buildAlongCourse.idea))
    assert.doesNotMatch(idea.html, /Desk<span class="sr-only">/)
    assert.doesNotMatch(idea.html, /Verified <time/)
    let course = await page(courseHref(buildAlongCourse.slug))
    assert.equal(course.html.match(/Desk<span class="sr-only">/g)?.length, 1)
  })

  it('shows the newest verified date on the course page', async () => {
    let { html } = await page(courseHref(buildAlongCourse.slug))
    assert.match(html, /Code verified <time datetime="2026-11-01">1 Nov 2026<\/time>/)
    let plain = await page(courseHref('what-is-an-llm'))
    assert.doesNotMatch(plain.html, /Code verified/)
  })
})
