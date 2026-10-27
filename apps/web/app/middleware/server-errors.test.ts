import * as assert from 'remix/assert'
import { createRouter } from 'remix/router'
import { get, route } from 'remix/routes'
import { describe, it } from 'remix/test'

import { logServerErrors } from './server-errors.ts'

const routes = route({
  boom: get('/boom'),
  unavailable: get('/unavailable'),
  fine: get('/fine'),
})

const router = createRouter({ middleware: [logServerErrors()] })
router.get(routes.boom, () => {
  throw new Error('Lookup failed for ada@example.com')
})
router.get(routes.unavailable, () => new Response('down', { status: 503 }))
router.get(routes.fine, () => new Response('ok'))

async function capture(path: string, init: RequestInit = {}) {
  let lines: { level: string; line: Record<string, unknown> }[] = []
  let originals = { error: console.error, info: console.info }
  console.error = (line: unknown) => lines.push({ level: 'error', line: JSON.parse(String(line)) })
  console.info = (line: unknown) => lines.push({ level: 'info', line: JSON.parse(String(line)) })
  try {
    let response = await router.fetch(new Request(`http://localhost${path}`, init))
    return { response, lines }
  } finally {
    Object.assign(console, originals)
  }
}

describe('logServerErrors (decision 039)', () => {
  it('answers a throw with a plain 500 and one error line: path, status, ray id, no query, no email', async () => {
    let { response, lines } = await capture('/boom?token=secret-token&email=ada%40example.com', {
      headers: { 'cf-ray': '8f00aa11bb22cc33-ORD' },
    })
    assert.equal(response.status, 500)
    assert.equal(await response.text(), 'Internal Server Error')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(lines.length, 1)
    let { level, line } = lines[0]!
    assert.equal(level, 'error')
    assert.equal(line.message, 'Unhandled request error')
    assert.equal(line.method, 'GET')
    assert.equal(line.path, '/boom')
    assert.equal(line.status, 500)
    assert.equal(line.rayId, '8f00aa11bb22cc33-ORD')
    let text = JSON.stringify(line)
    assert.doesNotMatch(text, /secret-token|ada@example\.com/)
    assert.match(text, /Lookup failed for \[email\]/)
  })

  it('logs a returned 5xx once, without changing it', async () => {
    let { response, lines } = await capture('/unavailable')
    assert.equal(response.status, 503)
    assert.equal(await response.text(), 'down')
    assert.deepEqual(
      lines.map(({ level, line }) => [level, line.message, line.status, line.rayId]),
      [['error', 'Server error response', 503, null]],
    )
  })

  it('stays quiet on success', async () => {
    let { response, lines } = await capture('/fine')
    assert.equal(response.status, 200)
    assert.equal(lines.length, 0)
  })
})
