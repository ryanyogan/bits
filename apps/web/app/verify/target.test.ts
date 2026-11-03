// The pure parts of the deploy check (decision 072): which origins are
// accepted, the URL that is called, the one fetch, and the grading.
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { VerifyBlock } from '../actions/courses/lesson/content.ts'
import { fetchLearnerWorker, VERIFY_MAX_BYTES, VERIFY_USER_AGENT } from './fetch.ts'
import { gradeVerify } from './grade.ts'
import { learnerOrigin, targetUrl } from './target.ts'

const block: VerifyBlock = {
  type: 'verify',
  id: 'health',
  xp: 30,
  gate: true,
  path: '/health',
  goal: 'Answers /health',
  task: '',
  expects: [
    { label: 'Says ok', kind: 'json', keys: ['ok'] },
    { label: 'Names the app', kind: 'match', patterns: [{ source: 'klippy' }] },
  ],
  hints: ['Return JSON from /health.'],
  hintsFor: [{ for: 'Names the app', text: 'Put klippy in the reply.' }],
}

describe('deploy check: origins, the fetch and grading (decision 072)', () => {
  it('accepts workers.dev origins only, and reduces them to the origin', () => {
    let ok = (input: string) => {
      let result = learnerOrigin(input)
      return result.ok ? result.origin : undefined
    }
    assert.equal(ok('https://klippy.ryan.workers.dev'), 'https://klippy.ryan.workers.dev')
    assert.equal(ok('  https://Klippy.Ryan.workers.dev/health?x=1#top  '), 'https://klippy.ryan.workers.dev')
    assert.equal(ok('klippy.ryan.workers.dev'), 'https://klippy.ryan.workers.dev')
    assert.equal(ok('https://abc123-klippy.ryan.workers.dev'), 'https://abc123-klippy.ryan.workers.dev')
    for (let bad of [
      '',
      'http://klippy.ryan.workers.dev',
      'https://workers.dev',
      'https://klippy.ryan.workers.dev.evil.com',
      'https://workers.dev.evil.com',
      'https://evilworkers.dev',
      'https://klippy.ryan.workers.dev.',
      'https://klippy.ryan.workers.dev:8443',
      'https://user:pass@klippy.ryan.workers.dev',
      'https://a.b.c.d.workers.dev',
      'https://127.0.0.1',
      'https://[::1]',
      'https://localhost',
      'https://bits.yogan.dev',
      'ftp://klippy.ryan.workers.dev',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://-bad.ryan.workers.dev',
      `https://${'a'.repeat(300)}.workers.dev`,
    ]) {
      assert.equal(ok(bad), undefined, bad)
    }
  })

  it('calls only the authored path on that origin', () => {
    assert.equal(targetUrl('https://k.r.workers.dev', '/health')?.href, 'https://k.r.workers.dev/health')
    assert.equal(targetUrl('https://k.r.workers.dev', '/api/status?full=1')?.href, 'https://k.r.workers.dev/api/status?full=1')
    assert.equal(targetUrl('https://k.r.workers.dev', '//evil.example/x'), undefined)
    assert.equal(targetUrl('https://k.r.workers.dev', '/@evil.example'), undefined)
    assert.equal(targetUrl('https://k.r.workers.dev', '/a/../b'), undefined)
    assert.equal(targetUrl('https://evil.example', '/health'), undefined)
    assert.equal(targetUrl('https://k.r.workers.dev/', '/health'), undefined)
  })

  it('makes one GET with a fixed User-Agent, no cookies, and never follows a redirect', async () => {
    let seen: { url: string; init?: RequestInit }[] = []
    let stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), init })
      return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } })
    }) as typeof fetch
    let result = await fetchLearnerWorker(new URL('https://k.r.workers.dev/health'), { fetch: stub })
    assert.deepEqual([result.kind, 'status' in result && result.status], ['redirect', 302])
    assert.equal(seen.length, 1)
    assert.equal(seen[0]!.init?.method, 'GET')
    assert.equal(seen[0]!.init?.redirect, 'manual')
    let headers = new Headers(seen[0]!.init?.headers)
    assert.equal(headers.get('User-Agent'), VERIFY_USER_AGENT)
    assert.equal(headers.get('Cookie'), null)
    assert.equal(headers.get('Authorization'), null)
  })

  it('times out, refuses an oversized body (declared or streamed), and reports a network failure', async () => {
    let url = new URL('https://k.r.workers.dev/health')
    let hang = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch
    assert.equal((await fetchLearnerWorker(url, { fetch: hang, timeoutMs: 20 })).kind, 'timeout')

    let declared = (async () => new Response('x', { headers: { 'Content-Length': String(VERIFY_MAX_BYTES + 1) } })) as typeof fetch
    assert.equal((await fetchLearnerWorker(url, { fetch: declared })).kind, 'too-large')

    let cancelled = false
    let streamed = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(new Uint8Array(16 * 1024))
          },
          cancel() {
            cancelled = true
          },
        }),
      )) as typeof fetch
    assert.equal((await fetchLearnerWorker(url, { fetch: streamed })).kind, 'too-large')
    assert.ok(cancelled, 'the stream is cancelled past the cap')

    let down = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    assert.equal((await fetchLearnerWorker(url, { fetch: down })).kind, 'network')

    let fine = (async () => new Response('{"ok":true}', { status: 200 })) as typeof fetch
    let result = await fetchLearnerWorker(url, { fetch: fine })
    assert.deepEqual(result.kind === 'response' && [result.status, result.body], [200, '{"ok":true}'])
  })

  it('grades the status, then each expect, with one hint', () => {
    let origin = 'https://k.r.workers.dev'
    let pass = gradeVerify(block, origin, { kind: 'response', status: 200, body: '{"ok":true,"app":"klippy"}', ms: 12 })
    assert.equal(pass.passed, true)
    assert.equal(pass.outcome, 'pass')
    assert.deepEqual(
      pass.checks.map((check) => [check.label, check.met]),
      [
        ['/health answers 200 OK', true],
        ['Says ok', true],
        ['Names the app', true],
      ],
    )

    let tied = gradeVerify(block, origin, { kind: 'response', status: 200, body: '{"ok":true}', ms: 12 })
    assert.deepEqual([tied.passed, tied.outcome, tied.hint], [false, 'checks', 'Put klippy in the reply.'])
    let general = gradeVerify(block, origin, { kind: 'response', status: 200, body: 'klippy', ms: 12 })
    assert.equal(general.hint, 'Return JSON from /health.')

    let missing = gradeVerify(block, origin, { kind: 'response', status: 404, body: 'klippy', ms: 3 })
    assert.deepEqual([missing.outcome, missing.status], ['status', 404])
    assert.match(missing.hint, /no \/health route/)
    assert.ok(missing.checks.every((check) => !check.met))

    for (let kind of ['timeout', 'network'] as const) {
      let failed = gradeVerify(block, origin, { kind, ms: 5000 })
      assert.deepEqual([failed.passed, failed.outcome, failed.checks.length], [false, kind, 0])
    }
    assert.equal(gradeVerify(block, origin, { kind: 'redirect', status: 301, ms: 4 }).outcome, 'redirect')
    assert.equal(gradeVerify(block, origin, { kind: 'too-large', status: 200, ms: 4 }).outcome, 'too-large')
    // The verdict carries labels and notes, never a pattern.
    assert.doesNotMatch(JSON.stringify(tied), /source|klippy"/)
  })
})
