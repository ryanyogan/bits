import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../../../routes.ts'
import { fetchAs, signIn } from '../../../test/auth.ts'

async function page(path: string, cookie: string | null = null) {
  let response = await fetchAs(cookie, path)
  return { status: response.status, headers: response.headers, html: await response.text() }
}

function count(html: string, pattern: RegExp) {
  return html.match(new RegExp(pattern.source, 'g'))?.length ?? 0
}

let temperature = { course: 'tokens-and-temperature', lesson: 'temperature' }
let theLoop = { course: 'first-agent-loop', lesson: 'the-loop' }

function lessonHref(params: { course: string; lesson: string }, mode?: string) {
  return routes.courses.lesson.index.href(params, mode ? { searchParams: { mode } } : undefined)
}

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('lesson page and author preview', () => {
  after(() => disposePlatform())

  it('renders Read mode by default with one h1, landmarks and the lesson text', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    assert.match(html, /<title>Temperature &amp; randomness · Tokens &amp; temperature · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    // Keyed per lesson, so client navigation to another lesson replaces its islands (F1).
    assert.match(html, /<main id="main" data-rmx-key="tokens-and-temperature\/temperature"/)
    assert.match(html, /aria-label="Lessons"/)
    // Tutor text is server-rendered, readable without JS.
    assert.match(html, /<strong[^>]*>every possible token a probability<\/strong>/)
    assert.match(html, /Moon café tagline/)
  })

  it('renders the app shell: one sticky header with the AppBar and the lesson sub-bar (decision 022)', async () => {
    let { html } = await page(lessonHref(temperature))
    assert.equal(count(html, /<header[\s>]/), 1)
    assert.match(html, /<header data-shell="sub"/)
    assert.equal(count(html, /Skip to content/), 1)
    // The same nav as every app page, with Courses current.
    assert.match(html, /aria-current="page"[^>]*>Courses</)
    assert.match(html, />My learning</)
    // The lesson title is the page's h1, inside the header's sub-bar.
    assert.match(html, /<header[\s\S]*<h1[^>]*>Temperature &amp; randomness<\/h1>[\s\S]*<\/header>/)
    // Narrow screens get the mode tabs at the top of the lesson.
    assert.equal(count(html, /aria-label="Lesson format"/), 2)
    // The sub-bar title's face is preloaded with the two every page gets (decision 023).
    assert.match(html, /<link rel="preload" as="font" type="font\/woff2" href="[^"]*unbounded-latin-500-normal\.woff2"/)

    let user = await signIn('shell@example.com')
    let signedIn = await page(lessonHref(temperature), user.cookie)
    // The reward XP island takes the bar's XP slot, keyed per lesson.
    assert.match(signedIn.html, /<span data-rmx-key="tokens-and-temperature\/temperature"[^>]*>[\s\S]{0,400}neurons/)
    assert.equal(count(signedIn.html, / neurons</), 1)
  })

  it('offers Watch only for lessons with video', async () => {
    let withVideo = await page(lessonHref(temperature))
    assert.match(withVideo.html, />Watch</)
    let withoutVideo = await page(lessonHref(theLoop))
    assert.doesNotMatch(withoutVideo.html, />Watch</)
    // ?mode=watch falls back to Read when there is no video.
    let fallback = await page(lessonHref(theLoop, 'watch'))
    assert.equal(fallback.status, 200)
    assert.match(fallback.html, /aria-current="page"[^>]*>Read</)
  })

  it('renders Watch mode with the video chapters and transcript', async () => {
    let { status, html } = await page(lessonHref(temperature, 'watch'))
    assert.equal(status, 200)
    assert.match(html, /Sharpening the odds/)
    assert.match(html, /Back to the exercise/)
  })

  it('renders Terminal mode with the code editor for code lessons', async () => {
    let { status, html } = await page(lessonHref(theLoop, 'terminal'))
    assert.equal(status, 200)
    assert.match(html, /aria-label="Code editor"/)
    assert.match(html, /agent\.ts/)
    assert.match(html, /npx tsx agent\.ts/)
  })

  it('gates "lesson complete" until the checks pass', async () => {
    let { html } = await page(lessonHref(temperature))
    assert.match(html, /Pass every check to finish/)
    assert.match(html, /Complete lesson/)
  })

  it('links modes without extra query params', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    assert.match(html, /href="\/courses\/tokens-and-temperature\/temperature\?mode=terminal"/)
    assert.doesNotMatch(html, /as=anon/)
  })

  it('404s an unknown lesson or course', async () => {
    assert.equal((await page(lessonHref({ course: 'tokens-and-temperature', lesson: 'nope' }))).status, 404)
    assert.equal((await page(lessonHref({ course: 'nope', lesson: 'temperature' }))).status, 404)
  })

  it('shows the signed-in account on the lesson 404 (decision 022)', async () => {
    let { cookie } = await signIn('lesson-404@example.com')
    let missing = await page(lessonHref({ course: 'tokens-and-temperature', lesson: 'nope' }), cookie)
    assert.equal(missing.status, 404)
    assert.match(missing.html, /aria-label="Your profile"/)
    assert.doesNotMatch(missing.html, />Start free</)
  })

  it('renders the same lesson under a Draft banner for an admin', async () => {
    let { cookie } = await signIn('preview-admin@example.com', { role: 'admin' })
    let { status, html } = await page(routes.author.course.preview.href(temperature), cookie)
    assert.equal(status, 200)
    assert.match(html, /DRAFT · v\d+ preview — not visible to learners/)
    assert.match(html, /Back to validation/)
    assert.match(html, /\(draft\) · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
  })

  it('sends signed-out visitors to log in', async () => {
    let response = await fetchAs(null, routes.author.course.preview.href(temperature))
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location') ?? '', /\/login/)
  })
})
