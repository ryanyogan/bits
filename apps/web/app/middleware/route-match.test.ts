import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { routes } from '../routes.ts'
import { anyOf, pathPrefix, routesIn, under } from './route-match.ts'

const url = (path: string) => new URL(path, 'http://localhost')

describe('route-match', () => {
  it('pathPrefix is the fixed start every route in a map shares', () => {
    assert.equal(pathPrefix(routes.settings), '/settings')
    assert.equal(pathPrefix(routes.me), '/me')
    assert.equal(pathPrefix(routes.courses), '/courses')
    // No prefix map of its own: the shared start of its routes.
    assert.equal(pathPrefix(routes.auth), '/auth')
    assert.equal(pathPrefix(routes.admin), '/admin')
    assert.equal(pathPrefix(routes.api), '/api')
  })

  it('under matches a path and what is below it, segment-wise', () => {
    let settings = anyOf(under(pathPrefix(routes.settings)))
    for (let path of ['/settings', '/settings/', '/settings/email/confirm']) assert.ok(settings.test(url(path)), path)
    for (let path of ['/settingsx', '/', '/me']) assert.ok(!settings.test(url(path)), path)
  })

  it('anyOf takes several patterns, and routesIn walks nested maps and forms', () => {
    let auth = routesIn(routes.auth).map((route) => String(route.pattern))
    assert.ok(auth.includes('/auth/verify'))
    assert.ok(auth.includes('/auth/oauth/:provider/callback'))
    let pages = anyOf(routes.me.index, routes.courses.lesson.index)
    assert.ok(pages.test(url('/me')))
    assert.ok(pages.test(url('/courses/a/b')))
    assert.ok(!pages.test(url('/courses/a')))
  })
})
