import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { router } from '../router.ts'
import { routes } from '../routes.ts'
import { formLimits, formScope } from './form-data.ts'

function post(path: string, body: BodyInit, headers?: HeadersInit) {
  return router.fetch(
    new Request(new URL(path, 'http://localhost'), {
      method: 'POST',
      body,
      headers: { Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', ...headers },
    }),
  )
}

const urlencoded = { 'Content-Type': 'application/x-www-form-urlencoded' }

// One flat suite: remix test runs after() around every describe.
describe('scoped form limits', () => {
  after(() => disposePlatform())

  it('picks the scope from the endpoint', () => {
    let at = (path: string) => formScope(new URL(path, 'http://localhost'))
    assert.equal(at(routes.login.action.href()), 'auth')
    assert.equal(at(routes.auth.verify.action.href()), 'auth')
    assert.equal(at(routes.logout.action.href()), 'auth')
    assert.equal(at(routes.api.authorUpload.href()), 'courseUpload')
    assert.equal(at(routes.api.drafts.href()), 'drafts')
    assert.equal(at(routes.courses.lesson.complete.href({ course: 'c', lesson: 'l' })), 'lessonSave')
    assert.equal(at(routes.api.run.href()), 'default')
    assert.equal(at(routes.settings.profile.href()), 'default')
  })

  it('answers 413 to a sign-in body over its limit, before the action runs', async () => {
    let big = `email=${'a'.repeat(formLimits.auth.maxTotalSize)}%40example.com&mode=signin`
    let response = await post(routes.login.action.href(), big, urlencoded)
    assert.equal(response.status, 413)
  })

  it('answers 413 to a file on a form that takes none', async () => {
    let body = new FormData()
    body.set('email', 'ada@example.com')
    body.set('avatar', new File(['x'], 'x.txt', { type: 'text/plain' }))
    let response = await post(routes.login.action.href(), body)
    assert.equal(response.status, 413)
  })

  it('answers 413 to an API body over the default limit', async () => {
    let body = new FormData()
    body.set('prompt', 'x'.repeat(formLimits.default.maxTotalSize + 1))
    let response = await post(routes.api.run.href(), body)
    assert.equal(response.status, 413)
  })

  it('still parses a sign-in form within its limit', async () => {
    let response = await post(routes.login.action.href(), 'email=ada%40example.com&mode=signin', urlencoded)
    assert.equal(response.status, 303)
  })
})
