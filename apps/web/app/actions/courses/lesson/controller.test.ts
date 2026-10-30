import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../../../routes.ts'
import { fetchAs, sessionCookieFrom, signIn, testDb } from '../../../test/auth.ts'

async function page(path: string, cookie: string | null = null) {
  let response = await fetchAs(cookie, path)
  return { status: response.status, headers: response.headers, html: await response.text() }
}

function count(html: string, pattern: RegExp) {
  return html.match(new RegExp(pattern.source, 'g'))?.length ?? 0
}

let temperature = { course: 'tokens-and-temperature', lesson: 'temperature' }
let theLoop = { course: 'first-agent-loop', lesson: 'the-loop' }

function lessonHref(params: { course: string; lesson: string }, query = '') {
  return routes.courses.lesson.index.href(params) + query
}

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('lesson page and author preview', () => {
  after(() => disposePlatform())

  it('renders the lesson with one h1, landmarks and the lesson text', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    assert.match(html, /<title>Temperature &amp; randomness · Tokens &amp; temperature · Bits<\/title>/)
    assert.equal(count(html, /<h1[\s>]/), 1)
    // Keyed per lesson, so client navigation to another lesson replaces its islands (F1).
    assert.match(html, /<main id="main" tabindex="-1" data-rmx-key="tokens-and-temperature\/temperature"/)
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
    // One view (decision 055): no format tabs anywhere.
    assert.equal(count(html, /aria-label="Lesson format"/), 0)
    // The sub-bar title's face is preloaded with the two every page gets (decision 023).
    assert.match(html, /<link data-rmx-key="[^"]+" rel="preload" as="font" type="font\/woff2" href="[^"]*unbounded-latin-500-normal\.woff2"/)

    let user = await signIn('shell@example.com')
    let signedIn = await page(lessonHref(temperature), user.cookie)
    // The reward XP island sits in the lesson sub-bar's XP slot, keyed per
    // lesson; the AppBar row above it carries no XP or streak pill (decision 048).
    assert.match(signedIn.html, /<header data-shell="sub"[\s\S]*<span data-rmx-key="tokens-and-temperature\/temperature"[^>]*>[\s\S]{0,400}neurons/)
    assert.equal(count(signedIn.html, / neurons</), 1)
    assert.doesNotMatch(signedIn.html, /-day streak/)
  })

  it('opens a lesson with a video with the player, above the first block (decision 055)', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    let video = html.indexOf('data-lesson-video=""')
    assert.ok(video > 0, 'the player renders')
    assert.ok(video < html.indexOf('Last lesson you saw'), 'above the first block')
    assert.match(html, /aria-label="Video: Temperature &amp; randomness"/)
    // Chapters come with it; the transcript starts closed, one button away.
    assert.match(html, /Sharpening the odds/)
    assert.match(html, /<button[^>]*aria-label="Transcript"[^>]*aria-pressed="false"|<button[^>]*aria-pressed="false"[^>]*aria-label="Transcript"/)
    assert.doesNotMatch(html, /<section aria-label="Transcript"/)
    // Without a video there is no player.
    assert.doesNotMatch((await page(lessonHref(theLoop))).html, /data-lesson-video=""/)
  })

  it('ignores an old ?mode= link: the same lesson, no redirect', async () => {
    for (let mode of ['terminal', 'watch', 'read', 'nonsense']) {
      let { status, html } = await page(lessonHref(theLoop, `?mode=${mode}`))
      assert.equal(status, 200)
      assert.match(html, /aria-label="Code editor"|agent\.ts/)
      assert.match(html, /<main id="main"/)
    }
    let watch = await page(lessonHref(temperature, '?mode=watch'))
    assert.equal(watch.status, 200)
    assert.ok(watch.html.indexOf('data-lesson-video=""') < watch.html.indexOf('Last lesson you saw'))
  })

  it('renders a code lesson in the one view: the editor and its Run output inline', async () => {
    let { status, html } = await page(lessonHref(theLoop))
    assert.equal(status, 200)
    assert.match(html, /agent\.ts/)
    assert.match(html, /npx tsx agent\.ts/)
  })

  it('gates "lesson complete" until the checks pass', async () => {
    let { html } = await page(lessonHref(temperature))
    assert.match(html, /Pass every check to finish/)
    assert.match(html, /Complete lesson/)
  })

  it('links nothing with a mode or extra query params', async () => {
    let { status, html } = await page(lessonHref(temperature))
    assert.equal(status, 200)
    assert.doesNotMatch(html, /[?&;]mode=/)
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
    assert.match(missing.html, /aria-label="Your profile, [^"]+"/)
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
  it('costs a signed-in lesson one D1 round trip, and a signed-out one none (decision 026)', async () => {
    let user = await signIn('roundtrips@example.com')
    // Warm the isolate's live catalog; after that, a page doesn't read it from D1.
    await page(lessonHref(temperature))
    let signedOut = await page(lessonHref(temperature))
    // No D1 at all: only the catalog entry, from the memo, and no R2 read (the lesson is memoised too).
    assert.match(signedOut.headers.get('Server-Timing') ?? '', /^catalog;dur=\d+;desc="memo"$/)
    // Session, user, completed lessons and the lesson's drafts come back in one batch.
    let signedIn = await page(lessonHref(temperature), user.cookie)
    assert.equal(signedIn.status, 200)
    assert.match(signedIn.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="3 queries, 1 round trips", catalog;dur=\d+;desc="memo"$/)
  })

  // ---- Lesson depth (decision 053) ----
  let plain = (lesson: string, query = '') => `/courses/plain-course/${lesson}${query}`
  const NEW = /New to this: a model reads your words/
  const ENGINEER = /Engineer: the model sees subword tokens/

  it('renders shared blocks plus the active depth: new by default, ?depth=engineer swaps it', async () => {
    let byDefault = await page(plain('lesson-1'))
    assert.equal(byDefault.status, 200)
    assert.match(byDefault.html, /of the plain test course/)
    assert.match(byDefault.html, NEW)
    assert.doesNotMatch(byDefault.html, ENGINEER)
    let engineer = await page(plain('lesson-1', '?depth=engineer'))
    assert.match(engineer.html, /of the plain test course/)
    assert.match(engineer.html, ENGINEER)
    assert.doesNotMatch(engineer.html, NEW)
    // An unknown depth is ignored.
    assert.match((await page(plain('lesson-1', '?depth=expert'))).html, NEW)
  })

  it('renders lists, ### as an h2 and ``` samples in the tutor turns (decision 061)', async () => {
    let { html } = await page(plain('lesson-2', '?depth=engineer'))
    assert.match(html, /<ul[^>]*><li[^>]*><p>a bulleted list with <code>code<\/code> and <strong>strong<\/strong> text<\/p><\/li>/)
    // The nested list sits inside its item.
    assert.match(html, /<p>an item with a nested list:<\/p><ul[^>]*><li[^>]*><p>one level deep<\/p><\/li>/)
    assert.match(html, /<ol[^>]*><li[^>]*><p>An ordered list\.<\/p><\/li>/)
    assert.match(html, /<h2[^>]*>A subheading<\/h2>/)
    // The engineer sample: named, focusable, highlighted; the new depth's isn't there.
    assert.match(html, /<figure[^>]*><figcaption[^>]*><span>TypeScript<\/span>/)
    assert.match(html, /<pre role="region" aria-label="TypeScript sample" tabindex="0"[^>]*><span><span[^>]*>const<\/span>/)
    assert.doesNotMatch(html, /a plain sample: no language/)
    assert.match((await page(plain('lesson-2', '?depth=new'))).html, /aria-label="Plain text sample"[^>]*><span><span[^>]*>a plain sample: no language/)
  })

  it('draws the depth control only on lessons with depth blocks: links, aria-current, no prefetch', async () => {
    let { html } = await page(plain('lesson-1', '?q=hi&mode=terminal&depth=engineer'))

    // One control (decision 055): the sub-bar cell (760px up) and the phone
    // chrome row, never the outline. Other params are kept, an old mode dropped.
    assert.equal(count(html, /aria-label="Lesson depth"/), 2)
    assert.match(html, /<header[\s\S]*aria-label="Lesson depth"[\s\S]*<\/header>/)
    assert.doesNotMatch(html, /Explain it/)
    assert.match(html, /<a href="\/courses\/plain-course\/lesson-1\?q=hi&amp;depth=new"[^>]*>New to this<\/a>/)
    assert.match(html, /<a href="\/courses\/plain-course\/lesson-1\?q=hi&amp;depth=engineer" aria-current="page"[^>]*>Engineer<\/a>/)
    // Following one remembers the choice, so a hover must not prefetch it (decision 042).
    assert.doesNotMatch(html, /href="[^"]*depth=[^"]*"[^>]*data-rmx-prefetch/)
    assert.equal(count((await page(lessonHref(temperature))).html, /aria-label="Lesson depth"/), 0)
  })

  it('remembers ?depth= in the session when signed out, for the next lesson', async () => {
    let first = await fetchAs(null, plain('lesson-1', '?depth=engineer'))
    let cookie = sessionCookieFrom(first)
    assert.ok(cookie, 'the choice starts a session')
    let next = await page(plain('lesson-2'), cookie)
    assert.match(next.html, /Engineer: each step samples one token/)
    assert.doesNotMatch(next.html, /New to this: the model guesses/)
    // The URL still wins over the remembered choice, and becomes the new one.
    assert.match((await page(plain('lesson-2', '?depth=new'), cookie)).html, /New to this: the model guesses/)
    assert.match((await page(plain('lesson-1'), cookie)).html, NEW)
  })

  it('remembers ?depth= in users.lesson_depth when signed in, with one UPDATE only when it changes', async () => {
    let { cookie, user } = await signIn('depth@example.com')
    let picked = await page(plain('lesson-1', '?depth=engineer'), cookie)
    assert.match(picked.html, ENGINEER)
    let row = await testDb.d1.prepare('select lesson_depth from users where id = ?').bind(user.id).first<{ lesson_depth: string }>()
    assert.equal(row?.lesson_depth, 'engineer')
    // The same choice again writes nothing: the page costs what any signed-in lesson does.
    let same = await page(plain('lesson-1', '?depth=engineer'), cookie)
    assert.match(same.headers.get('Server-Timing') ?? '', /db;dur=\d+;desc="3 queries, 1 round trips"/)
    // Another browser signed in to the account follows the saved choice.
    let other = await signIn('depth@example.com')
    assert.match((await page(plain('lesson-2'), other.cookie)).html, /Engineer: each step samples one token/)
    // Changing it is one more statement.
    let changed = await page(plain('lesson-2', '?depth=new'), other.cookie)
    assert.match(changed.headers.get('Server-Timing') ?? '', /db;dur=\d+;desc="4 queries, 2 round trips"/)
    assert.match((await page(plain('lesson-1'), cookie)).html, NEW)
  })
})
