// Lesson videos (decision 029): the multipart upload through the Worker into
// R2 (in-memory in tests), serving with Range support, the hotlink guard,
// and builds linking ready uploads (lessons without one publish text-only).
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { fetchAs, signIn } from '../test/auth.ts'
import { testVideo, testVideoBytes } from '../test/videos.ts'
import { PART_SIZE } from './upload.ts'
import { parseRange } from './serve.ts'

const course = 'tokens-and-temperature'
const mediaHref = (id: string) => routes.media.video.href({ id })

let admin: Promise<string> | undefined
function asAdmin(path: string, init?: RequestInit) {
  admin ??= signIn('video-admin@example.com', { role: 'admin' }).then((session) => session.cookie)
  return admin.then((cookie) => fetchAs(cookie, path, init))
}

function fields(values: Record<string, string>): FormData {
  let body = new FormData()
  for (let [name, value] of Object.entries(values)) body.set(name, value)
  return body
}

function start(path: string, size: number, cookie?: Promise<string>) {
  let init = { method: 'POST', body: fields({ course, path, size: String(size) }) }
  return cookie ? cookie.then((c) => fetchAs(c, routes.api.authorVideoStart.href(), init)) : asAdmin(routes.api.authorVideoStart.href(), init)
}

// One flat suite: remix test runs after() around every describe.
describe('lesson videos', () => {
  after(() => disposePlatform())

  it('uploads in parts, resumes, completes and serves the file', async () => {
    let size = PART_SIZE + 1234
    let bytes = Uint8Array.from({ length: size }, (_, i) => (i * 7) % 256)
    let path = 'assets/05-greedy-vs-sampled.mp4'

    let response = await start(path, size)
    assert.equal(response.status, 201)
    let started = (await response.json()) as { id: string; partSize: number; parts: number; done: number[] }
    assert.equal(started.partSize, PART_SIZE)
    assert.equal(started.parts, 2)
    assert.deepEqual(started.done, [])

    let part = (n: number, body: Uint8Array) =>
      asAdmin(routes.api.authorVideoPart.href({ id: started.id, part: String(n) }), { method: 'PUT', body: new Blob([body as BlobPart]) })
    // A part of the wrong size is refused.
    assert.equal((await part(1, bytes.slice(0, 10))).status, 422)
    assert.equal((await part(1, bytes.slice(0, PART_SIZE))).status, 200)

    // Completing early names the missing part.
    let early = await asAdmin(routes.api.authorVideoComplete.href({ id: started.id }), { method: 'POST', body: fields({ duration: '95' }) })
    assert.equal(early.status, 409)
    assert.deepEqual(((await early.json()) as { missing: number[] }).missing, [2])

    // Starting again with the same file resumes the same upload.
    let resumed = (await (await start(path, size)).json()) as { id: string; done: number[] }
    assert.equal(resumed.id, started.id)
    assert.deepEqual(resumed.done, [1])

    assert.equal((await part(2, bytes.slice(PART_SIZE))).status, 200)
    let done = await asAdmin(routes.api.authorVideoComplete.href({ id: started.id }), { method: 'POST', body: fields({ duration: '95.4' }) })
    assert.equal(done.status, 200)
    assert.deepEqual(await done.json(), { id: started.id, status: 'ready', src: mediaHref(started.id), duration: 95 })

    let served = await fetchAs(null, mediaHref(started.id), { headers: { Range: `bytes=${PART_SIZE}-` } })
    assert.equal(served.status, 206)
    assert.equal(served.headers.get('Content-Range'), `bytes ${PART_SIZE}-${size - 1}/${size}`)
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes.slice(PART_SIZE))

    // Finished uploads take no more parts.
    assert.equal((await part(2, bytes.slice(PART_SIZE))).status, 409)
  })

  it('lets only the course’s authors upload', async () => {
    assert.equal((await fetchAs(null, routes.api.authorVideoStart.href(), { method: 'POST', body: fields({ course, path: 'assets/x.mp4', size: '10' }) })).status, 401)
    let learner = signIn('video-learner@example.com').then((session) => session.cookie)
    assert.equal((await start('assets/x.mp4', 10, learner)).status, 403)
    let author = signIn('video-author@example.com', { role: 'author' }).then((session) => session.cookie)
    assert.equal((await start('assets/x.mp4', 10, author)).status, 403, 'not an author of this course')
    assert.equal((await start('../escape.mp4', 10)).status, 422)
    assert.equal((await start('assets/x.mov', 10)).status, 422)
  })

  it('serves ranges, conditional requests, and refuses hotlinks', async () => {
    let href = mediaHref(testVideo.id)
    let full = await fetchAs(null, href)
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('Content-Type'), 'video/mp4')
    assert.equal(full.headers.get('Accept-Ranges'), 'bytes')
    assert.equal(full.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
    assert.equal(full.headers.get('Content-Length'), String(testVideo.size))
    let etag = full.headers.get('ETag')!
    await full.arrayBuffer()

    let range = await fetchAs(null, href, { headers: { Range: 'bytes=10-19' } })
    assert.equal(range.status, 206)
    assert.equal(range.headers.get('Content-Range'), `bytes 10-19/${testVideo.size}`)
    assert.deepEqual(new Uint8Array(await range.arrayBuffer()), testVideoBytes().slice(10, 20))

    let suffix = await fetchAs(null, href, { headers: { Range: 'bytes=-5' } })
    assert.equal(suffix.headers.get('Content-Range'), `bytes ${testVideo.size - 5}-${testVideo.size - 1}/${testVideo.size}`)
    await suffix.arrayBuffer()

    assert.equal((await fetchAs(null, href, { headers: { Range: `bytes=${testVideo.size}-` } })).status, 416)
    assert.equal((await fetchAs(null, href, { headers: { 'If-None-Match': etag } })).status, 304)
    assert.equal((await fetchAs(null, href, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
    assert.equal((await fetchAs(null, href, { headers: { Referer: 'https://elsewhere.example/page' } })).status, 403)
    assert.equal((await fetchAs(null, mediaHref('00000000-0000-4000-8000-00000000dead'))).status, 404)
    assert.equal((await fetchAs(null, routes.media.video.href({ id: 'nope' }))).status, 404)
  })

  it('parses single byte ranges only', () => {
    assert.deepEqual(parseRange('bytes=0-99'), { offset: 0, length: 100 })
    assert.deepEqual(parseRange('bytes=100-'), { offset: 100 })
    assert.deepEqual(parseRange('bytes=-20'), { suffix: 20 })
    assert.equal(parseRange(null), undefined)
    assert.equal(parseRange('bytes=0-1,4-5'), null)
    assert.equal(parseRange('bytes=9-1'), null)
    assert.equal(parseRange('items=0-1'), null)
  })
})
