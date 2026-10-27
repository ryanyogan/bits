import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { readSessionWithUser } from '../queries/auth.ts'
import { createUser, findUserById } from '../queries/users.ts'
import type { D1Database } from './types.ts'
import { createD1Database } from './database.ts'
import { createD1Meter, meterD1 } from './meter.ts'

describe('D1 meter and the one-round-trip session read', () => {
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

  it('counts statements, calls and sequential round trips', async () => {
    let meter = createD1Meter()
    let db = createD1Database(meterD1(d1, meter))
    await db.d1.prepare('select 1').first()
    assert.deepEqual({ ...meter, ms: 0 }, { queries: 1, calls: 1, waves: 1, ms: 0 })

    // Parallel calls are one round trip; a batch is one call of many statements.
    await Promise.all([db.d1.prepare('select 1').all(), db.d1.prepare('select 2').raw()])
    await db.batch([db.d1.prepare('select ?').bind(1), db.d1.prepare('select ?').bind(2)])
    assert.deepEqual({ ...meter, ms: 0 }, { queries: 5, calls: 4, waves: 3, ms: 0 })

    // data-table queries go through the same binding.
    await findUserById(db, 'nobody')
    assert.equal(meter.waves, 4)
  })

  it('reads a session with its user, and optionally the completed lessons, in one round trip', async () => {
    let db = createD1Database(d1)
    let user = await createUser(db, { email: 'grace@example.com', goals: ['agents'] })
    let now = 10_000
    await db.batch([
      d1
        .prepare(
          `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
           values ('signed-in', ?, '[{}, {}]', null, ?, ?, ?), ('signed-out', null, '[{}, {}]', null, ?, ?, ?)`,
        )
        .bind(user.id, now + 1, now, now, now + 1, now, now),
      d1
        .prepare(
          `insert into lesson_progress (user_id, course_id, lesson_slug, started_at, completed_at, updated_at)
           values (?, 'c', 'one', 1, 5, 5), (?, 'c', 'two', 1, 7, 7), (?, 'c', 'open', 1, null, 1)`,
        )
        .bind(user.id, user.id, user.id),
    ])

    let meter = createD1Meter()
    let metered = createD1Database(meterD1(d1, meter))
    let read = await readSessionWithUser(metered, 'signed-in', now)
    assert.equal(read?.session.user_id, user.id)
    assert.deepEqual(read?.user, await findUserById(db, user.id), 'decoded like data-table (goals, is_public)')
    assert.equal(read?.completed, undefined)

    let withCompleted = await readSessionWithUser(metered, 'signed-in', now, { completed: true })
    assert.deepEqual(
      withCompleted?.completed?.map((row) => row.lesson_slug),
      ['two', 'one'],
      'newest first, unfinished left out',
    )
    assert.equal(meter.waves, 2, 'one round trip per read')

    let signedOut = await readSessionWithUser(metered, 'signed-out', now, { completed: true })
    assert.equal(signedOut?.user, null)
    assert.equal(signedOut?.completed, undefined)

    assert.equal(await readSessionWithUser(metered, 'signed-in', now + 1), null, 'expired')
    assert.equal(await readSessionWithUser(metered, 'unknown', now), null)
  })
})
