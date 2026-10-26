import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../../router.ts'
import { routes } from '../../routes.ts'

after(() => disposePlatform())

function request(path: string, init?: RequestInit) {
  return router.fetch(new Request(new URL(path, 'http://localhost'), init))
}

function post(path: string, fields: Record<string, string> = {}) {
  let body = new FormData()
  for (let [name, value] of Object.entries(fields)) body.set(name, value)
  return request(path, { method: 'POST', body })
}

describe('/author', () => {
  it('renders upload, repo sync, the course list and the block reference', async () => {
    let response = await request(routes.author.index.href())
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Write a course · bits<\/title>/)
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1)
    assert.match(html, /Courses are just markdown\./)
    assert.match(html, new RegExp(`action="${routes.api.authorUpload.href()}"`))
    assert.match(html, /enctype="multipart\/form-data"/)
    assert.match(html, /webkitdirectory/)
    assert.match(html, new RegExp(`action="${routes.author.repo.href()}"`))
    assert.match(html, /YOUR COURSES/)
    assert.match(html, /2 errors/)
    assert.match(html, /role="region" aria-label="Block reference"/)
    assert.match(html, /id, xp, multiple\?/)
  })

  it('saving repo settings redirects back with a status', async () => {
    let response = await post(routes.author.repo.href(), { repository: 'a/b', branch: 'main' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/author?repo=saved')
  })
})

describe('/author/:course', () => {
  it('shows the validation report with Preview draft and Publish', async () => {
    let response = await request(routes.author.course.index.href({ course: 'tokens-and-temperature' }))
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.match(html, /<title>Tokens &amp; temperature · Authoring · bits<\/title>|<title>Tokens & temperature · Authoring · bits<\/title>/)
    assert.match(html, /Warning: <\/span>07-top-p\.md/)
    assert.match(html, /href="\/author\/tokens-and-temperature\/preview\/what-is-a-token"/)
    assert.match(html, /popovertarget="publish-confirm"/)
    assert.match(html, /Roll back to v2/)
    assert.match(html, /top-p\.mp4/)
  })

  it('errors block publishing', async () => {
    let page = await request(routes.author.course.index.href({ course: 'first-agent-loop' }))
    let html = await page.text()
    assert.match(html, /aria-disabled="true"/)
    assert.match(html, /Fix 2 errors to publish/)
    let response = await post(routes.author.course.publish.href({ course: 'first-agent-loop' }))
    assert.equal(response.status, 422)
  })

  it('publish and rollback flip the live version', async () => {
    let published = await post(routes.author.course.publish.href({ course: 'tokens-and-temperature' }))
    assert.equal(published.status, 303)
    assert.equal(published.headers.get('Location'), '/author/tokens-and-temperature?live=4&done=published')
    let rolledBack = await post(routes.author.course.rollback.href({ course: 'tokens-and-temperature' }), { version: '2' })
    assert.equal(rolledBack.headers.get('Location'), '/author/tokens-and-temperature?live=2&done=rolledback')
    let page = await (await request('/author/tokens-and-temperature?live=2&done=rolledback')).text()
    assert.match(page, /Rolled back: v2 is live again\./)
  })

  it('unknown courses are a 404', async () => {
    let response = await request(routes.author.course.index.href({ course: 'nope' }))
    assert.equal(response.status, 404)
  })
})
