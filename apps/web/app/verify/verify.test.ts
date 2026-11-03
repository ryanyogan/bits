// POST /api/verify (decision 072) end to end, on real D1: the journal, the
// caps, the lesson save, signed-out refusal, the no-JS path and the
// certificate's proof link. The learner's Worker is a stub of
// globalThis.fetch for *.workers.dev; nothing leaves the process.
import { findUserById } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { routes } from '../routes.ts'
import { completeLesson, fetchAs, form, signIn, testDb, testIp } from '../test/auth.ts'
import { verifyLimits } from './verify.ts'

const COURSE = 'verify-course'
const LESSON = 'ship-it'
const lessonHref = routes.courses.lesson.index.href({ course: COURSE, lesson: LESSON })
const GOOD = '{"ok":true,"app":"klippy"}'

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** Runs `fn` with *.workers.dev answered by `handler`; returns the calls the stub saw. */
async function withWorker<T>(handler: Handler, fn: (calls: { url: string; init?: RequestInit }[]) => Promise<T>): Promise<T> {
  let real = globalThis.fetch
  let calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.hostname.endsWith('.workers.dev')) {
      calls.push({ url: url.href, init })
      return handler(url, init)
    }
    return real(input, init)
  }) as typeof fetch
  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = real
  }
}

const healthy: Handler = (url) =>
  url.pathname === '/health' ? Response.json(JSON.parse(GOOD)) : new Response('hello from klippy', { status: 200 })

function postVerify(cookie: string | null, input: { verify?: string; url: string; ip?: string; json?: boolean; lesson?: string }) {
  let headers: Record<string, string> = { 'CF-Connecting-IP': input.ip ?? testIp() }
  if (input.json !== false) headers.Accept = 'application/json'
  return fetchAs(cookie, routes.api.verify.href(), {
    method: 'POST',
    headers,
    body: form({ course: COURSE, lesson: input.lesson ?? LESSON, verify: input.verify ?? 'health', url: input.url }),
  })
}

async function rows(where: string, ...binds: unknown[]) {
  let result = await testDb.d1
    .prepare(`select user_id, verify_id, origin, path, outcome, status from build_checks where ${where} order by created_at`)
    .bind(...binds)
    .all<{ user_id: string; verify_id: string; origin: string; path: string; outcome: string; status: number | null }>()
  return result.results
}

// One flat suite: remix test runs after() around every describe.
describe('/api/verify (decision 072)', () => {
  after(() => disposePlatform())

  it('checks the learner’s Worker from the server, journals it, and the save reads the journal', async () => {
    let { user, cookie } = await signIn('verify-pass@example.com')
    let origin = 'https://klippy-pass.someone.workers.dev'

    // Before any check the save is refused, whatever the form says.
    let early = await completeLesson(cookie, COURSE, LESSON, { 'verify.health': 'pass', passed: 'true' })
    assert.equal(early.status, 422)
    assert.match(await early.text(), /Not saved: check your deployed Worker first/)

    await withWorker(healthy, async (calls) => {
      let response = await postVerify(cookie, { url: `${origin}/whatever?token=secret` })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      let verdict = await response.json()
      assert.equal(verdict.passed, true)
      assert.equal(verdict.origin, origin)
      assert.deepEqual(
        verdict.checks.map((check: { label: string; met: boolean }) => [check.label, check.met]),
        [
          ['/health answers 200 OK', true],
          ['Says ok', true],
          ['Names the app', true],
        ],
      )
      // The block's path, never the learner's path or query; no cookies sent on.
      assert.deepEqual(
        calls.map((call) => call.url),
        [`${origin}/health`],
      )
      assert.equal(new Headers(calls[0]!.init?.headers).get('Cookie'), null)
    })
    assert.deepEqual(
      (await rows('user_id = ?', user.id)).map((row) => [row.verify_id, row.origin, row.path, row.outcome, row.status]),
      [['health', origin, '/health', 'pass', 200]],
    )

    // The page draws it as passed (from the session), and never shows a pattern.
    let page = await (await fetchAs(cookie, lessonHref)).text()
    assert.match(page, /✓ live/)
    assert.doesNotMatch(page, /\\s\?:\\s\?/)
    assert.match(page, new RegExp(origin.replaceAll('.', '\\.')), 'the field starts with the origin checked last')

    let saved = await completeLesson(cookie, COURSE, LESSON)
    assert.equal(saved.status, 303)
    assert.equal((await findUserById(testDb, user.id))!.xp_total, 40, 'the check’s 30 and the lesson’s 10')
  })

  it('reports each failure with one hint, and a failed check never passes the save', async () => {
    let { user, cookie } = await signIn('verify-fail@example.com')
    let origin = 'https://klippy-fail.someone.workers.dev'
    let cases: [Handler, string, RegExp][] = [
      [() => Response.json({ ok: true }), 'checks', /klippy/],
      [() => new Response('nope', { status: 404 }), 'status', /no \/health route/],
      [() => new Response(null, { status: 301, headers: { Location: 'https://evil.example/' } }), 'redirect', /doesn’t follow redirects/],
      [() => new Response('x'.repeat(70 * 1024)), 'too-large', /over 64 KiB/],
      [
        () => {
          throw new TypeError('fetch failed')
        },
        'network',
        /couldn’t reach/,
      ],
    ]
    for (let [handler, outcome, hint] of cases) {
      await withWorker(handler, async (calls) => {
        let verdict = await (await postVerify(cookie, { url: origin })).json()
        assert.deepEqual([verdict.passed, verdict.outcome], [false, outcome])
        assert.match(verdict.hint, hint)
        assert.equal(calls.length, 1, 'one call, never a followed redirect')
      })
    }
    assert.deepEqual(
      (await rows('user_id = ?', user.id)).map((row) => row.outcome),
      cases.map(([, outcome]) => outcome),
    )
    assert.equal((await completeLesson(cookie, COURSE, LESSON)).status, 422)
  })

  it('refuses anything but a workers.dev origin before journalling or fetching', async () => {
    let { user, cookie } = await signIn('verify-refuse@example.com')
    await withWorker(healthy, async (calls) => {
      for (let url of ['http://k.r.workers.dev', 'https://bits.yogan.dev', 'https://127.0.0.1', 'https://k.r.workers.dev.evil.com', 'https://u:p@k.r.workers.dev']) {
        let response = await postVerify(cookie, { url })
        assert.equal(response.status, 422, url)
        let body = await response.json()
        assert.equal(body.error, 'invalid_url')
        assert.ok(body.message)
      }
      assert.equal(calls.length, 0)
    })
    assert.equal((await rows('user_id = ?', user.id)).length, 0)
    assert.equal((await postVerify(cookie, { url: 'https://k.r.workers.dev', verify: 'no-such-check' })).status, 404)
  })

  it('signed out: refused with a sign-in prompt, never journalled or fetched, however many visitor ids', async () => {
    let origin = 'https://klippy-visitor.someone.workers.dev'
    let ip = testIp()
    await withWorker(healthy, async (calls) => {
      // Fresh sessions from one IP: each would be a new visitor id.
      for (let n = 0; n < 30; n++) {
        let response = await postVerify(null, { url: origin, ip })
        assert.equal(response.status, 401)
        assert.match((await response.json()).message, /Sign in to check your deploy/)
      }
      assert.equal(calls.length, 0)
      assert.equal((await rows('origin = ?', origin)).length, 0)
      // None of that touches a signed-in learner checking the same Worker.
      let { cookie } = await signIn('verify-after-visitors@example.com')
      assert.equal((await postVerify(cookie, { url: origin, ip })).status, 200)
    })
    let page = await (await fetchAs(null, lessonHref)).text()
    assert.match(page, /Sign in to check your deploy/)
  })

  it('a Workers Preview never calls out: refused before journalling or fetching', async () => {
    let { user, cookie } = await signIn('verify-preview@example.com')
    let env = platform.env as unknown as Record<string, unknown>
    let saved = { APP_ENV: env.APP_ENV, CANONICAL_ORIGIN: env.CANONICAL_ORIGIN, EMAIL: env.EMAIL }
    Object.assign(env, { APP_ENV: 'preview', CANONICAL_ORIGIN: undefined, EMAIL: undefined })
    try {
      await withWorker(healthy, async (calls) => {
        let response = await postVerify(cookie, { url: 'https://klippy-preview.someone.workers.dev' })
        assert.equal(response.status, 422)
        let body = await response.json()
        assert.equal(body.error, 'preview')
        assert.match(body.message, /off on preview deploys/)
        assert.equal(calls.length, 0)
      })
    } finally {
      Object.assign(env, saved)
    }
    assert.equal((await rows('user_id = ?', user.id)).length, 0)
  })

  it('caps checks per user, per user per origin, and per origin (soft for newcomers, hard for all)', async () => {
    await withWorker(healthy, async (calls) => {
      // Per user, across origins.
      let { cookie: busy } = await signIn('verify-busy@example.com')
      for (let n = 0; n < verifyLimits.userPerHour; n++) {
        assert.equal((await postVerify(busy, { url: `https://cap-${n}.someone.workers.dev` })).status, 200)
      }
      let before = calls.length
      assert.equal((await postVerify(busy, { url: 'https://cap-x.someone.workers.dev' })).status, 429)
      assert.equal(calls.length, before, 'a refused check never calls out')

      // One user hammering someone else's Worker spends only its own
      // per-origin quota: the owner can still check (security review, 072).
      let target = 'https://victim.someone.workers.dev'
      let { cookie: attacker } = await signIn('verify-attacker@example.com')
      for (let n = 0; n < verifyLimits.originPerUserHour; n++) {
        assert.equal((await postVerify(attacker, { url: target })).status, 200)
      }
      assert.equal((await postVerify(attacker, { url: target })).status, 429, 'the attacker’s per-origin cap')
      let { cookie: owner } = await signIn('verify-owner@example.com')
      assert.equal((await postVerify(owner, { url: target })).status, 200, 'the owner is not locked out')

      // Past the soft cap a newcomer waits, but the owner, already checking, stays in.
      let filler = (await signIn('verify-filler@example.com')).user
      let now = Date.now()
      let fill = (from: number, to: number) =>
        testDb.d1.batch(
          Array.from({ length: to - from }, (_, n) =>
            testDb.d1
              .prepare(
                `insert into build_checks (id, user_id, course_id, lesson_slug, verify_id, origin, path, outcome, created_at)
                 values (?, ?, 'verify-course', 'ship-it', 'health', ?, '/health', 'pass', ?)`,
              )
              .bind(`fill-${from + n}`, filler.id, target, now),
          ),
        )
      let used = verifyLimits.originPerUserHour + 1
      await fill(used, verifyLimits.originSoftHour)
      let { cookie: newcomer } = await signIn('verify-newcomer@example.com')
      before = calls.length
      assert.equal((await postVerify(newcomer, { url: target })).status, 429)
      assert.equal(calls.length, before)
      assert.equal((await postVerify(owner, { url: target })).status, 200, 'an owner already checking stays in')

      // The hard cap bounds the calls for everyone.
      await fill(verifyLimits.originSoftHour + 1, verifyLimits.originHardHour)
      assert.equal((await postVerify(owner, { url: target })).status, 429, 'the hard cap holds')
    })
  })

  it('without JS: the native form gets a 303 back to its place, and the page shows the verdict or the refusal', async () => {
    let { cookie } = await signIn('verify-native@example.com')
    await withWorker(() => Response.json({ ok: true }), async () => {
      let response = await postVerify(cookie, { url: 'https://klippy-native.someone.workers.dev', json: false })
      assert.equal(response.status, 303)
      assert.equal(response.headers.get('Location'), `${lessonHref}#verify-health`)
      let page = await (await fetchAs(cookie, response.headers.get('Location')!)).text()
      assert.match(page, /Not yet/)
      assert.match(page, /Return Response\.json/)
    })
    let refused = await postVerify(cookie, { url: 'https://example.com', json: false })
    assert.equal(refused.status, 303)
    let page = await (await fetchAs(cookie, refused.headers.get('Location')!)).text()
    assert.match(page, /workers\.dev only/)
  })

  it('a certificate links the course’s final passing deploy, on a public profile only', async () => {
    let { user, cookie } = await signIn('verify-cert@example.com', { handle: 'verifycert' })
    let origin = 'https://klippy-cert.someone.workers.dev'
    await withWorker(healthy, async () => {
      assert.equal((await postVerify(cookie, { url: origin })).status, 200)
    })
    assert.equal((await completeLesson(cookie, COURSE, LESSON)).status, 303)
    let href = routes.certificates.show.href({ handle: 'verifycert', course: COURSE })

    await testDb.d1.prepare('update users set is_public = 1 where id = ?').bind(user.id).run()
    let shown = await (await fetchAs(null, href)).text()
    assert.match(shown, new RegExp(`href="${origin.replaceAll('.', '\\.')}"`))
    assert.match(shown, /doesn’t prove who wrote it/)

    await testDb.d1.prepare('update users set is_public = 0 where id = ?').bind(user.id).run()
    let own = await (await fetchAs(cookie, href)).text()
    assert.doesNotMatch(own, new RegExp(origin.replaceAll('.', '\\.')), 'a private profile never shows it')
  })
})
