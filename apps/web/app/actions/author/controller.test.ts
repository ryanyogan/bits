import * as path from 'node:path'

import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../../routes.ts'
import { coursesDir, readCourseFolder } from '../../../scripts/lib/content-folder.ts'
import { fetchAs, signIn } from '../../test/auth.ts'

const brokenDir = path.resolve(coursesDir, '../fixtures/broken-course')

// Admins manage every course, including the ones the test platform published.
let admin: Promise<string> | undefined
async function request(path: string, init?: RequestInit, cookie?: string) {
  admin ??= signIn('author-admin@example.com', { role: 'admin' }).then((session) => session.cookie)
  return fetchAs(cookie ?? (await admin), path, init)
}

function post(path: string, fields: Record<string, string> = {}, cookie?: string) {
  let body = new FormData()
  for (let [name, value] of Object.entries(fields)) body.set(name, value)
  return request(path, { method: 'POST', body }, cookie)
}

/** Uploads a course folder the way the DropZone does: text files by path, media by name. */
async function upload(dir: string, options: { cookie?: string; folder?: string; edit?: (path: string, text: string) => string } = {}) {
  let body = new FormData()
  let folder = options.folder ?? path.basename(dir)
  for (let file of await readCourseFolder(dir)) {
    let name = `${folder}/${file.path}`
    if (file.text === undefined) body.append('assets', name)
    else body.append('files', new File([options.edit ? options.edit(file.path, file.text) : file.text], name))
  }
  return request(routes.api.authorUpload.href(), { method: 'POST', body, headers: { Accept: '*/*' } }, options.cookie)
}

// One flat suite: remix test runs after() around every describe, and D1 must
// stay up until the last test.
describe('/author and /author/:course', () => {
  after(() => disposePlatform())

  it('renders upload, repo sync, the course list and the block reference', async () => {
    let response = await request(routes.author.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Write a course · Bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Courses are just markdown\./)
    assert.match(html, new RegExp(`action="${routes.api.authorUpload.href()}"`))
    assert.match(html, /enctype="multipart\/form-data"/)
    assert.match(html, /webkitdirectory/)
    assert.match(html, new RegExp(`action="${routes.author.repo.href()}"`))
    assert.match(html, /<h2 id="your-courses"[^>]*>Your courses<\/h2>/)
    assert.match(html, /href="\/author\/tokens-and-temperature"/)
    assert.match(html, /v1 live/)
    assert.match(html, /role="region" aria-label="Block reference"/)
    assert.match(html, /id, xp, multiple\?/)
  })

  it('reads /author and /author/:course in one batch after the session (decision 035)', async () => {
    for (let href of [routes.author.index.href(), routes.author.course.index.href({ course: 'tokens-and-temperature' })]) {
      let response = await request(href)
      assert.equal(response.status, 200)
      // The session read, then courses, builds, authors and videos together.
      assert.match(response.headers.get('Server-Timing') ?? '', /^db;dur=\d+;desc="5 queries, 2 round trips"$/, href)
      await response.text()
    }
  })

  it('saving repo settings redirects back with a status', async () => {
    let response = await post(routes.author.repo.href(), { repository: 'a/b', branch: 'main' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/author?repo=saved')
  })

  it('shows the live build’s validation report and Preview draft', async () => {
    let response = await request(routes.author.course.index.href({ course: 'tokens-and-temperature' }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Tokens &amp; temperature · Authoring · Bits<\/title>|<title>Tokens & temperature · Authoring · Bits<\/title>/)
    // Lesson 6's video is uploaded and ready (the test platform seeds it); lesson 1's isn't (decision 029).
    assert.match(html, /Warning: <\/span>01-what-is-a-token\.md → video not uploaded yet: assets\/01-what-is-a-token\.mp4/)
    assert.doesNotMatch(html, /video not uploaded yet: assets\/06-temperature/)
    assert.match(html, /ready · 4:30/)
    assert.match(html, /Passed: <\/span>8 lessons, order 1–8, no gaps/)
    assert.match(html, /href="\/author\/tokens-and-temperature\/preview\/what-is-a-token"/)
    assert.match(html, /live · v1/)
    assert.doesNotMatch(html, /popovertarget="publish-confirm"/)
  })

  it('a broken folder is recorded with its errors, and errors block publishing', async () => {
    let response = await upload(brokenDir)
    assert.equal(response.status, 201)
    let { courses } = (await response.json()) as { courses: { slug: string; version: number; errors: number; href: string }[] }
    assert.deepEqual(courses, [{ slug: 'broken-course', version: 1, errors: 4, warnings: 2, href: '/author/broken-course' }])

    let html = await (await request(courses[0]!.href)).text()
    assert.match(html, /Error: <\/span>01-no-checks\.md:10 → :::prompt has no - check lines/)
    assert.match(html, /Error: <\/span>02-duplicate-order\.md → duplicate order: 2/)
    assert.match(html, /aria-disabled="true"/)
    assert.match(html, /Fix 4 errors to publish/)
    assert.doesNotMatch(html, /Preview draft/)
    let publish = await post(routes.author.course.publish.href({ course: 'broken-course' }))
    assert.equal(publish.status, 422)
    // Not in the catalog.
    let catalog = await (await fetchAs(null, routes.courses.index.href())).text()
    assert.doesNotMatch(catalog, /broken-course/)
  })

  it('publishing makes an uploaded course visible; rollback flips it back', async () => {
    let author = await signIn('new-author@example.com', { role: 'author' })
    let source = path.join(coursesDir, 'what-is-an-llm')
    let first = await upload(source, {
      cookie: author.cookie,
      folder: 'my-first-course',
      edit: (file, text) => (file === 'course.md' ? text.replace('title: "What is an LLM, really?"', 'title: "My first course"') : text),
    })
    assert.equal(first.status, 201)
    let lessonPath = routes.courses.lesson.index.href({ course: 'my-first-course', lesson: 'say-hi-to-claude' })
    assert.equal((await fetchAs(null, lessonPath)).status, 404, 'drafts are not public')

    // The uploader owns it: it's on their /author, and they can publish it.
    let home = await (await fetchAs(author.cookie, routes.author.index.href())).text()
    assert.match(home, /href="\/author\/my-first-course"/)
    let published = await post(routes.author.course.publish.href({ course: 'my-first-course' }), { version: '1' }, author.cookie)
    assert.equal(published.status, 303)
    assert.equal(published.headers.get('Location'), '/author/my-first-course?done=published')
    assert.match(await (await fetchAs(author.cookie, published.headers.get('Location')!)).text(), /v1 is live\./)
    assert.match(await (await fetchAs(null, routes.courses.index.href())).text(), /My first course/)
    assert.equal((await fetchAs(null, lessonPath)).status, 200)

    // v2 renames the course; publish it, then roll back to v1.
    await upload(source, {
      cookie: author.cookie,
      folder: 'my-first-course',
      edit: (file, text) => (file === 'course.md' ? text.replace('title: "What is an LLM, really?"', 'title: "My renamed course"') : text),
    })
    await post(routes.author.course.publish.href({ course: 'my-first-course' }), { version: '2' }, author.cookie)
    assert.match(await (await fetchAs(null, routes.courses.index.href())).text(), /My renamed course/)
    let rolledBack = await post(routes.author.course.rollback.href({ course: 'my-first-course' }), { version: '1' }, author.cookie)
    assert.equal(rolledBack.headers.get('Location'), '/author/my-first-course?done=rolledback')
    assert.match(await (await fetchAs(author.cookie, rolledBack.headers.get('Location')!)).text(), /Rolled back: v1 is live again\./)
    let catalog = await (await fetchAs(null, routes.courses.index.href())).text()
    assert.match(catalog, /My first course/)
    assert.doesNotMatch(catalog, /My renamed course/)
  })

  it('two authors racing to upload a new slug: one owns it, the other gets 403', async () => {
    let [a, b] = await Promise.all([
      signIn('race-a@example.com', { role: 'author' }),
      signIn('race-b@example.com', { role: 'author' }),
    ])
    let source = path.join(coursesDir, 'what-is-an-llm')
    let responses = await Promise.all([
      upload(source, { cookie: a.cookie, folder: 'race-course' }),
      upload(source, { cookie: b.cookie, folder: 'race-course' }),
    ])
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 403])
    let winner = responses[0]!.status === 201 ? a : b
    let loser = winner === a ? b : a
    let page = routes.author.course.index.href({ course: 'race-course' })
    assert.equal((await fetchAs(winner.cookie, page)).status, 200)
    assert.equal((await fetchAs(loser.cookie, page)).status, 403)
    // Only the winner's build was recorded.
    let html = await (await request(page)).text()
    assert.match(html, /\bv1\b/)
    // Whole words: generated class names (rmxc-…) can contain "v2".
    assert.doesNotMatch(html, /\bv2\b/)
  })

  it('unknown courses are a 404', async () => {
    let response = await request(routes.author.course.index.href({ course: 'nope' }))
    assert.equal(response.status, 404)
  })

  it('anonymous visitors go to /login; learners and non-owning authors get 403', async () => {
    let paths = [
      routes.author.index.href(),
      routes.author.course.index.href({ course: 'tokens-and-temperature' }),
      routes.author.course.preview.href({ course: 'tokens-and-temperature', lesson: 'temperature' }),
    ]
    for (let path of paths) {
      let anonymous = await fetchAs(null, path)
      assert.equal(anonymous.status, 303, path)
      assert.equal(anonymous.headers.get('Location'), `/login?next=${encodeURIComponent(path)}`)
    }

    let learner = await signIn('learner@example.com')
    for (let path of paths) {
      let response = await fetchAs(learner.cookie, path)
      assert.equal(response.status, 403, path)
      assert.match(await response.text(), /You can(?:'|&#39;)t open this one\./)
    }
    assert.equal((await upload(brokenDir, { cookie: learner.cookie })).status, 403)

    // An author who doesn't own the course sees an empty /author and 403s on it.
    let author = await signIn('other-author@example.com', { role: 'author' })
    let home = await fetchAs(author.cookie, routes.author.index.href())
    assert.equal(home.status, 200)
    assert.doesNotMatch(await home.text(), /href="\/author\/tokens-and-temperature"/)
    for (let path of paths.slice(1)) {
      assert.equal((await fetchAs(author.cookie, path)).status, 403, path)
    }
    let publish = await fetchAs(author.cookie, routes.author.course.publish.href({ course: 'tokens-and-temperature' }), {
      method: 'POST',
    })
    assert.equal(publish.status, 403)
    // …and can't overwrite it by uploading a folder with its slug.
    let hijack = await upload(path.join(coursesDir, 'tokens-and-temperature'), { cookie: author.cookie })
    assert.equal(hijack.status, 403)
  })
})
