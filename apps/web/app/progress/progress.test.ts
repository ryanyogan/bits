import { findUserById, recordLessonCompletion } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform } from '#platform'

import { routes } from '../routes.ts'
import { answerAsk, completeLesson, fetchAs, form, requestCode, runAt, sessionCookieFrom, signIn, testDb } from '../test/auth.ts'
import { addDays, currentStreak, localDay } from './days.ts'
import { levelFor } from './levels.ts'

const COURSE = 'tokens-and-temperature'
const GOOD_PROMPT = 'Write a tagline for a coffee shop on the moon. Under 6 words.'
const passing = { 'prompt.moon-tagline': GOOD_PROMPT }
/** The Temperature lesson's exercise, for runAt (runs at 0 and 1.0 are required). */
const moon = { course: COURSE, lesson: 'temperature', exercise: 'moon-tagline', prompt: GOOD_PROMPT }

async function xpOf(userId: string) {
  return (await findUserById(testDb, userId))!.xp_total
}

async function count(sql: string, ...binds: unknown[]) {
  let row = await testDb.d1.prepare(sql).bind(...binds).first<{ n: number }>()
  return row!.n
}

// One flat suite: remix test runs after() around every describe.
describe('progress', () => {
  after(() => disposePlatform())

  it('a forged pass earns nothing: the server re-runs the checks', async () => {
    let { cookie, user } = await signIn('forger@example.com')
    let attempts: Record<string, string | string[]>[] = [
      { 'prompt.moon-tagline': 'give me neurons' },
      // The prompt passes but the runs were never made.
      { 'prompt.moon-tagline': GOOD_PROMPT },
      // Runs are counted from the server's journal: `ran` fields are ignored.
      { 'prompt.moon-tagline': GOOD_PROMPT, 'ran.moon-tagline': ['0', '100'] },
      // XP fields are not read at all.
      { 'prompt.moon-tagline': 'nope', xp: '9999' },
    ]
    for (let fields of attempts) {
      let response = await completeLesson(cookie, COURSE, 'temperature', fields)
      assert.equal(response.status, 422, JSON.stringify(fields))
      assert.match(await response.text(), /Not saved: /)
    }
    assert.equal(await xpOf(user.id), 0)
    assert.equal(await count('select count(*) as n from lesson_progress where user_id = ?', user.id), 0)
    assert.equal(await count('select count(*) as n from xp_events where user_id = ?', user.id), 0)
  })

  it('a real pass saves the lesson, the prompt, the neurons and the streak, once', async () => {
    let { cookie, user } = await signIn('learner@example.com')
    await runAt(cookie, moon, [0, 100])
    // A stale `mode` field from an old page is ignored (decision 055).
    let response = await completeLesson(cookie, COURSE, 'temperature', { ...passing, mode: 'terminal' })
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/courses/tokens-and-temperature/top-p-and-friends')

    let saved = (await findUserById(testDb, user.id))!
    assert.equal(saved.xp_total, 40)
    assert.equal(saved.streak_days, 1)
    assert.equal(saved.best_streak, 1)
    assert.equal(saved.streak_last_day, localDay(Date.now(), saved.timezone))
    let attempt = await testDb.d1
      .prepare(`select prompt, passed from exercise_attempts where user_id = ? and source = 'submit'`)
      .bind(user.id)
      .first<{ prompt: string; passed: number }>()
    assert.deepEqual(attempt, { prompt: GOOD_PROMPT, passed: 1 })
    assert.equal(await count(`select count(*) as n from user_badges where user_id = ? and badge_id = 'first-token'`, user.id), 1)

    // Completing it again records the attempt but awards nothing new.
    assert.equal((await completeLesson(cookie, COURSE, 'temperature', passing)).status, 303)
    assert.equal(await xpOf(user.id), 40)
    assert.equal(await count(`select count(*) as n from exercise_attempts where user_id = ? and source = 'submit'`, user.id), 2)

    let html = await (await fetchAs(cookie, routes.courses.course.index.href({ course: COURSE }))).text()
    assert.match(html, /Temperature &amp; randomness<span class="sr-only"> — completed/)
    let lesson = await (await fetchAs(cookie, routes.courses.lesson.index.href({ course: COURSE, lesson: 'temperature' }))).text()
    assert.match(lesson, /Lesson complete/)
    assert.match(lesson, /aria-label="40 neurons"|>40</)
  })

  it('a quick check gates the lesson, and only a journalled right answer opens it (decision 052)', async () => {
    let { user, cookie } = await signIn('quiz-right@example.com')
    // Posting "correct" with the save, in any field, earns nothing.
    let forged = await completeLesson(cookie, COURSE, 'what-is-a-token', {
      'quiz.common-words': 'a',
      'answer.common-words': 'a',
      'asks.common-words': 'true',
    })
    assert.equal(forged.status, 422)
    assert.match(await forged.text(), /Not saved: answer the quick check first\./)
    assert.equal(await xpOf(user.id), 0)

    // A wrong answer is journalled, earns nothing and keeps the gate shut.
    let wrong = await answerAsk(cookie, COURSE, 'what-is-a-token', 'common-words', 'b')
    assert.equal(wrong.verdict.correct, false)
    assert.equal(wrong.verdict.xp, 0)
    assert.equal((await completeLesson(cookie, COURSE, 'what-is-a-token')).status, 422)

    // A right one (its letter, or its text) earns the ask's share at once, once.
    let right = await answerAsk(cookie, COURSE, 'what-is-a-token', 'common-words', 'a')
    assert.deepEqual([right.verdict.correct, right.verdict.xp, right.verdict.saved], [true, 10, true])
    assert.equal(await xpOf(user.id), 10)
    let again = await answerAsk(cookie, COURSE, 'what-is-a-token', 'common-words', '“ the”')
    assert.deepEqual([again.verdict.correct, again.verdict.xp], [true, 0])
    assert.equal(
      await count('select count(*) as n from ask_attempts where user_id = ? and ask_id = ?', user.id, 'common-words'),
      3,
    )

    // Now the save goes through and earns the rest of the lesson. The next page
    // shows the first lesson's badge (a badge beats the plain neurons notice).
    let saved = await completeLesson(cookie, COURSE, 'what-is-a-token')
    assert.equal(saved.status, 303)
    assert.equal(await xpOf(user.id), 30)
    let next = await (await fetchAs(cookie, saved.headers.get('Location')!)).text()
    assert.match(next, /Badge earned: First token/)
  })

  it('signed out: progress is kept in the session and merged at sign-in', async () => {
    let anonymous = await runAt(null, moon, [0, 100])
    assert.ok(anonymous, 'the visitor gets a session on the first run')
    let response = await completeLesson(anonymous, COURSE, 'temperature', passing)
    assert.equal(response.status, 303)
    anonymous = sessionCookieFrom(response) ?? anonymous
    let catalog = await (await fetchAs(anonymous, routes.courses.index.href())).text()
    assert.match(catalog, /Up next:/)
    // Resume at the first unfinished lesson, as the syllabus marks it.
    assert.match(catalog, /Up next: <span[^>]*>What is a token\?/)

    // Sign in from the same browser (the session cookie comes along).
    let { code } = await requestCode('merge@example.com')
    let verified = await fetchAs(anonymous, routes.auth.verify.action.href(), {
      method: 'POST',
      body: form({ email: 'merge@example.com', code }),
    })
    assert.equal(verified.status, 303)
    let signedIn = sessionCookieFrom(verified)!
    assert.notEqual(signedIn, anonymous)

    let user = (await testDb.d1.prepare('select id from users where email = ?').bind('merge@example.com').first<{ id: string }>())!
    assert.equal(await xpOf(user.id), 40)
    assert.equal(await count('select count(*) as n from lesson_progress where user_id = ? and completed_at is not null', user.id), 1)
    // The signed-out runs joined the account's journal.
    assert.equal(await count(`select count(*) as n from exercise_attempts where user_id = ? and source != 'submit'`, user.id), 2)
    let course = await (await fetchAs(signedIn, routes.courses.course.index.href({ course: COURSE }))).text()
    assert.match(course, /Temperature &amp; randomness<span class="sr-only"> — completed/)

    // The merged progress left the session: signing in again adds nothing.
    let row = await testDb.d1
      .prepare(`select data from sessions where user_id = ?`)
      .bind(user.id)
      .first<{ data: string }>()
    assert.doesNotMatch(row!.data, /"progress"/)
  })

  it('streaks: the next day extends, a gap restarts, best is kept', async () => {
    let { user } = await signIn('streak@example.com')
    let record = (day: string, n: number) =>
      recordLessonCompletion(testDb, {
        userId: user.id,
        courseId: 'streak-course',
        lessonSlug: `lesson-${n}`,
        attempts: [],
        awards: [{ id: crypto.randomUUID(), kind: 'lesson', ref: `streak-course/lesson-${n}`, xp: 10 }],
        day,
        yesterday: addDays(day, -1),
        now: Date.parse(`${day}T12:00:00Z`),
      })
    await record('2026-10-01', 1)
    await record('2026-10-01', 2)
    await record('2026-10-02', 3)
    await record('2026-10-03', 4)
    let after3 = (await findUserById(testDb, user.id))!
    assert.equal(after3.streak_days, 3)
    await record('2026-10-07', 5)
    let gap = (await findUserById(testDb, user.id))!
    assert.equal(gap.streak_days, 1)
    assert.equal(gap.best_streak, 3)
    assert.equal(gap.xp_total, 50)
    let day = await testDb.d1
      .prepare('select xp, actions from activity_days where user_id = ? and day = ?')
      .bind(user.id, '2026-10-01')
      .first()
    assert.deepEqual(day, { xp: 20, actions: 2 })

    assert.equal(currentStreak({ ...gap, streak_last_day: '2026-10-07' }, Date.parse('2026-10-08T12:00:00Z')), 1)
    assert.equal(currentStreak({ ...gap, streak_last_day: '2026-10-07' }, Date.parse('2026-10-09T12:00:00Z')), 0)
  })

  it('days and levels', () => {
    assert.equal(localDay(Date.parse('2026-10-26T23:30:00Z'), 'UTC'), '2026-10-26')
    assert.equal(localDay(Date.parse('2026-10-26T23:30:00Z'), 'Asia/Tokyo'), '2026-10-27')
    assert.equal(localDay(Date.parse('2026-10-26T23:30:00Z'), 'Not/AZone'), '2026-10-26')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
    assert.deepEqual(levelFor(0), { level: 1, name: 'Curious', pct: 0, toNext: 50 })
    assert.deepEqual(levelFor(1240), { level: 7, name: 'Prompt wrangler', pct: 48, toNext: 260 })
    assert.equal(levelFor(99999).toNext, 0)
  })
})
