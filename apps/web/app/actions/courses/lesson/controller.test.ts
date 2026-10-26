import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../../router.ts'
import { routes } from '../../../routes.ts'

after(() => disposePlatform())

async function page(path: string) {
  let response = await router.fetch(new Request(new URL(path, 'http://localhost')))
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

describe('lesson page', () => {
  it('renders Read mode by default with one h1, landmarks and the lesson text', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    assert.match(html, /<title>Temperature &amp; randomness · Tokens &amp; temperature · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    assert.match(html, /<main id="main"/)
    assert.match(html, /aria-label="Lessons"/)
    // Tutor text is server-rendered, readable without JS.
    assert.match(html, /<strong[^>]*>every possible token a probability<\/strong>/)
    assert.match(html, /Moon café tagline/)
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

  it('keeps ?as=anon on mode links for the signed-out variant', async () => {
    let { status, html } = await page(routes.courses.lesson.index.href(temperature, { searchParams: { as: 'anon' } }))
    assert.equal(status, 200)
    assert.match(html, /mode=terminal&amp;as=anon|as=anon&amp;mode=terminal/)
  })

  it('404s an unknown lesson or course', async () => {
    assert.equal((await page(lessonHref({ course: 'tokens-and-temperature', lesson: 'nope' }))).status, 404)
    assert.equal((await page(lessonHref({ course: 'nope', lesson: 'temperature' }))).status, 404)
  })
})

describe('author lesson preview', () => {
  it('renders the same lesson under a Draft banner', async () => {
    let { status, html } = await page(routes.author.course.preview.href(temperature))
    assert.equal(status, 200)
    assert.match(html, /DRAFT · v\d+ preview — not visible to learners/)
    assert.match(html, /Back to validation/)
    assert.match(html, /\(draft\) · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
  })

  it('sends signed-out visitors to log in', async () => {
    let response = await router.fetch(
      new Request(new URL(routes.author.course.preview.href(temperature, { searchParams: { as: 'anon' } }), 'http://localhost')),
    )
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Location') ?? '', /\/login/)
  })
})
