// Lesson drafts and the watch position on the server (decision 029): saved
// by POST /api/drafts for signed-in learners, rendered back into the lesson's
// islands, and limited to the drafts a lesson actually has.
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../../routes.ts'
import { fetchAs, signIn } from '../../test/auth.ts'

const course = 'tokens-and-temperature'
const lesson = 'temperature'
const lessonHref = (mode?: string) =>
  routes.courses.lesson.index.href({ course, lesson }, mode ? { searchParams: { mode } } : undefined)

function save(cookie: string | null, pairs: [string, string][], target = { course, lesson }) {
  let body = new FormData()
  body.set('course', target.course)
  body.set('lesson', target.lesson)
  for (let [key, value] of pairs) {
    body.append('key', key)
    body.append('value', value)
  }
  return fetchAs(cookie, routes.api.drafts.href(), { method: 'POST', body })
}

// One flat suite: remix test runs after() around every describe.
describe('lesson drafts', () => {
  after(() => disposePlatform())

  it('saves drafts and the watch position, and renders them back', async () => {
    let { cookie } = await signIn('drafts@example.com')
    let response = await save(cookie, [
      ['prompt:moon-tagline', 'A tagline for a moon café'],
      ['video', '135'],
    ])
    assert.equal(response.status, 204)
    // A later save replaces the earlier one.
    assert.equal((await save(cookie, [['video', '140']])).status, 204)

    let read = await (await fetchAs(cookie, lessonHref())).text()
    assert.match(read, /A tagline for a moon café/)
    assert.match(read, /"sync":\{"action":"\/api\/drafts"/)

    let watch = await (await fetchAs(cookie, lessonHref('watch'))).text()
    assert.match(watch, /"initialTime":140/)
    assert.match(watch, /"src":"\/media\/videos\/[0-9a-f-]{36}\.mp4"/)

    // Someone else sees none of it.
    let other = await signIn('drafts-other@example.com')
    let theirs = await (await fetchAs(other.cookie, lessonHref())).text()
    assert.doesNotMatch(theirs, /A tagline for a moon café/)
  })

  it('refuses signed-out saves, unknown keys and oversized drafts', async () => {
    assert.equal((await save(null, [['video', '10']])).status, 401)
    let { cookie } = await signIn('drafts-limits@example.com')
    assert.equal((await save(cookie, [['prompt:nope', 'x']])).status, 422)
    assert.equal((await save(cookie, [['prompt:moon-tagline', 'x'.repeat(4001)]])).status, 422)
    assert.equal((await save(cookie, Array.from({ length: 9 }, () => ['video', '1'] as [string, string]))).status, 422)
    assert.equal((await save(cookie, [['video', '1']], { course, lesson: 'no-such-lesson' })).status, 404)
    // A lesson without a ready video has no position to keep.
    assert.equal((await save(cookie, [['video', '1']], { course, lesson: 'what-is-a-token' })).status, 422)
  })

  it('signed out, the page renders no server sync', async () => {
    let html = await (await fetchAs(null, lessonHref())).text()
    assert.doesNotMatch(html, /"sync":\{/)
    assert.match(html, /"persist":\{"id":"tokens-and-temperature\/temperature\/moon-tagline","key":"prompt:moon-tagline"\}/)
  })
})
