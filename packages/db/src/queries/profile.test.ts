import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database } from '../d1/database.ts'
import { createD1Meter, meterD1 } from '../d1/meter.ts'
import type { D1Database } from '../d1/types.ts'
import { listIdentities, readSessionWithUser } from './auth.ts'
import { countAttempts, listActivityDays, listAttempts, listCompletedLessons, listUserBadges } from './progress.ts'
import { readProfileRows, readPublicProfile, readUserWithCompleted } from './profile.ts'
import { createUser } from './users.ts'

describe('profile reads in one batch (decision 035)', () => {
  let d1: D1Database
  let dispose: () => Promise<void>

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    d1 = testD1.d1
  })

  after(async () => {
    await dispose()
  })

  async function seed(email: string, isPublic: boolean) {
    let db = createD1Database(d1)
    let user = await createUser(db, { email })
    let now = 10_000
    await db.batch([
      d1.prepare('update users set is_public = ? where id = ?').bind(isPublic ? 1 : 0, user.id),
      d1
        .prepare(
          `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
           values (?, ?, '[{}, {}]', null, ?, ?, ?)`,
        )
        .bind(`session-${user.id}`, user.id, now + 1, now, now),
      d1
        .prepare(
          `insert into lesson_progress (user_id, course_id, lesson_slug, started_at, completed_at, updated_at)
           values (?1, 'c', 'one', 1, 5, 5), (?1, 'c', 'two', 1, 7, 7), (?1, 'c', 'open', 1, null, 1)`,
        )
        .bind(user.id),
      d1
        .prepare(
          `insert into exercise_attempts (id, user_id, course_id, lesson_slug, exercise_id, prompt, source, temperature, passed, created_at)
           values (?1 || '-a', ?1, 'c', 'one', 'e', 'first', 'submit', null, 1, 1),
                  (?1 || '-b', ?1, 'c', 'one', 'e', 'second', 'live', 100, null, 2),
                  (?1 || '-c', ?1, 'c', 'two', 'e', 'third', 'submit', null, 0, 3)`,
        )
        .bind(user.id),
      d1.prepare(`insert into user_badges (user_id, badge_id, awarded_at) values (?1, 'first', 4), (?1, 'course:c', 8)`).bind(user.id),
      d1
        .prepare(`insert into activity_days (user_id, day, xp, actions) values (?1, '2026-01-01', 5, 1), (?1, '2026-03-01', 10, 3)`)
        .bind(user.id),
      d1
        .prepare(`insert into identities (provider, provider_user_id, user_id, email, created_at) values ('github', ?1, ?1, null, 9)`)
        .bind(user.id),
    ])
    return { user, now }
  }

  it('reads the same rows as the separate queries, in one call', async () => {
    let db = createD1Database(d1)
    let { user, now } = await seed('ada@example.com', true)
    let options = { activitySince: '2026-02-01' }
    let expected = {
      completed: await listCompletedLessons(db, user.id),
      attempts: await listAttempts(db, user.id, 50),
      promptsWritten: await countAttempts(db, user.id),
      badges: await listUserBadges(db, user.id),
      activity: await listActivityDays(db, user.id, options.activitySince),
      identities: await listIdentities(db, user.id),
    }
    assert.equal(expected.attempts.length, 3)
    assert.equal(expected.activity.length, 1)

    let meter = createD1Meter()
    let metered = createD1Database(meterD1(d1, meter))
    assert.deepEqual(await readProfileRows(metered, user.id, options), expected)
    assert.deepEqual({ calls: meter.calls, waves: meter.waves }, { calls: 1, waves: 1 })

    // With the session read: still one call.
    let read = await readSessionWithUser(metered, `session-${user.id}`, now, { completed: true, profile: options })
    assert.deepEqual(read?.profile, expected)
    assert.deepEqual(read?.completed, expected.completed)
    assert.deepEqual({ calls: meter.calls, waves: meter.waves }, { calls: 2, waves: 2 })

    let byHandle = await readPublicProfile(metered, user.handle.toUpperCase(), options)
    assert.equal(byHandle?.user.id, user.id)
    assert.deepEqual(byHandle?.rows, expected)
    assert.equal(meter.waves, 3)

    let withCompleted = await readUserWithCompleted(metered, user.handle)
    assert.deepEqual(withCompleted?.completed, expected.completed)
    assert.equal(meter.waves, 4)
  })

  it('never reads a private profile by handle, and knows unknown handles', async () => {
    let db = createD1Database(d1)
    let { user } = await seed('private@example.com', false)
    assert.equal(await readPublicProfile(db, user.handle, { activitySince: '2026-01-01' }), null)
    assert.equal(await readPublicProfile(db, 'nobody-here', { activitySince: '2026-01-01' }), null)
    // Certificates check visibility themselves.
    assert.equal((await readUserWithCompleted(db, user.handle))?.completed.length, 2)
    assert.equal(await readUserWithCompleted(db, 'nobody-here'), null)
  })
})
