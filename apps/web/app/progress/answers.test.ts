import { findUserById } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import {
  answerAsk,
  completeLesson,
  fetchAs,
  form,
  postAnswer,
  requestCode,
  sessionCookieFrom,
  signIn,
  testDb,
  testIp,
} from '../test/auth.ts'
import { plainCourse } from '../test/plain-course.ts'
import { askLimits } from './answers.ts'

// Lesson 3 of the plain course has one ungated typed quick check (decision 052).
const COURSE = plainCourse.slug
const LESSON = 'lesson-3'
const ASK = 'name-a-unit'
const lessonHref = routes.courses.lesson.index.href({ course: COURSE, lesson: LESSON })

async function xpOf(userId: string) {
  return (await findUserById(testDb, userId))!.xp_total
}

async function rows(where: string, ...binds: unknown[]) {
  let result = await testDb.d1
    .prepare(`select user_id, visitor, ip_hash, answer, correct from ask_attempts where ${where} order by created_at`)
    .bind(...binds)
    .all<{ user_id: string | null; visitor: string | null; ip_hash: string | null; answer: string; correct: number }>()
  return result.results
}

// One flat suite: remix test runs after() around every describe.
describe('/api/ask (decision 052)', () => {
  after(() => disposePlatform())

  it('grades typed answers on the server: a reject explains, an accept passes', async () => {
    let { user, cookie } = await signIn('typed-ask@example.com')
    let wrong = await answerAsk(cookie, COURSE, LESSON, ASK, 'letters')
    assert.equal(wrong.verdict.correct, false)
    assert.match(wrong.verdict.feedback ?? '', /not single letters/)
    let right = await answerAsk(cookie, COURSE, LESSON, ASK, 'Tokens, I think')
    assert.deepEqual([right.verdict.correct, right.verdict.xp, right.verdict.saved], [true, 10, true])
    assert.equal(await xpOf(user.id), 10)
    assert.deepEqual(
      (await rows('user_id = ?', user.id)).map((row) => [row.answer, row.correct, row.visitor]),
      [
        ['letters', 0, null],
        ['Tokens, I think', 1, null],
      ],
    )
  })

  it('never sends the patterns to the browser, and shows a right answer as answered', async () => {
    let { cookie } = await signIn('page-ask@example.com')
    let before = await (await fetchAs(cookie, lessonHref)).text()
    assert.match(before, /What does a model read and write/)
    assert.doesNotMatch(before, /tokens\?\\b|letters\?/)
    await answerAsk(cookie, COURSE, LESSON, ASK, 'tokens')
    let after = await (await fetchAs(cookie, lessonHref)).text()
    assert.doesNotMatch(after, /tokens\?\\b|letters\?/)
    assert.match(after, /answered/)
  })

  it('a late answer on a completed lesson still earns its neurons', async () => {
    let { user, cookie } = await signIn('late-ask@example.com')
    // The first lesson earns a badge; the next save says what it added.
    assert.equal((await completeLesson(cookie, COURSE, 'lesson-1')).status, 303)
    let before = await xpOf(user.id)
    let saved = await completeLesson(cookie, COURSE, LESSON)
    assert.equal(saved.status, 303)
    assert.equal(await xpOf(user.id), before + 30)
    assert.match(await (await fetchAs(cookie, saved.headers.get('Location')!)).text(), /\+30 neurons · saved/)
    let late = await answerAsk(cookie, COURSE, LESSON, ASK, 'a token')
    assert.deepEqual([late.verdict.correct, late.verdict.xp], [true, 10])
    assert.equal(await xpOf(user.id), before + 40)
  })

  it('signed out: the answer carries the visitor id and moves to the account at sign-in', async () => {
    let { cookie, verdict } = await answerAsk(null, COURSE, LESSON, ASK, 'tokens')
    assert.ok(cookie, 'the visitor gets a session on the first answer')
    assert.deepEqual([verdict.correct, verdict.xp, verdict.saved], [true, 10, false])
    let [row] = await rows(`answer = 'tokens' and user_id is null`)
    assert.ok(row?.visitor, 'journalled with the visitor id')
    assert.ok(row?.ip_hash, 'and a hashed IP for the per-IP limit')

    // Complete the lesson signed out, then sign in from the same browser.
    let completed = await completeLesson(cookie, COURSE, LESSON)
    assert.equal(completed.status, 303)
    cookie = sessionCookieFrom(completed) ?? cookie
    // The quick check already showed its 10; the save shows the lesson's 30.
    let landed = await (await fetchAs(cookie, completed.headers.get('Location')!)).text()
    assert.match(landed, /\+30 neurons · sign in to keep them/)
    let { code } = await requestCode('visitor-ask@example.com')
    let verified = await fetchAs(cookie, routes.auth.verify.action.href(), {
      method: 'POST',
      body: form({ email: 'visitor-ask@example.com', code }),
    })
    assert.equal(verified.status, 303)
    let user = (await testDb.d1.prepare('select id from users where email = ?').bind('visitor-ask@example.com').first<{ id: string }>())!
    assert.equal((await rows('user_id = ?', user.id)).length, 1, 'the answer joined the account')
    assert.equal((await rows('visitor = ?', row!.visitor)).filter((r) => r.user_id === null).length, 0)
    assert.equal(await xpOf(user.id), 40, 'the lesson and the quick check')
  })

  it('without JS: the native form gets a 303 back to its place, and the page shows the verdict', async () => {
    let { cookie } = await signIn('native-ask@example.com')
    let response = await postAnswer(cookie, { course: COURSE, lesson: LESSON, ask: ASK, answer: 'letters', json: false })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), `${lessonHref}#ask-${ASK}`)
    let html = await (await fetchAs(cookie, lessonHref)).text()
    assert.match(html, /Not quite/)
    assert.match(html, /not single letters/)
    // The flash is read once.
    assert.doesNotMatch(await (await fetchAs(cookie, lessonHref)).text(), /not single letters/)
  })

  it('refuses unknown asks, empty answers and answers past the hourly cap', async () => {
    let { cookie } = await signIn('limits-ask@example.com')
    assert.equal((await postAnswer(cookie, { course: COURSE, lesson: LESSON, ask: 'nope', answer: 'x' })).status, 404)
    assert.equal((await postAnswer(cookie, { course: COURSE, lesson: LESSON, ask: ASK, answer: '   ' })).status, 422)

    // A signed-out visitor: the cap is enforced by the insert itself.
    let visitor: string | null = null
    let ip = testIp()
    for (let n = 0; n < askLimits.anonymousPerHour; n++) {
      let response = await postAnswer(visitor, { course: COURSE, lesson: LESSON, ask: ASK, answer: `guess ${n}`, ip })
      assert.equal(response.status, 200, `answer ${n}`)
      visitor = sessionCookieFrom(response) ?? visitor
    }
    let refused = await postAnswer(visitor, { course: COURSE, lesson: LESSON, ask: ASK, answer: 'one more', ip })
    assert.equal(refused.status, 429)
    assert.equal((await rows(`answer = 'one more'`)).length, 0)
  })
})
