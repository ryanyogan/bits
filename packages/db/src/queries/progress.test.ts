import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database } from '../d1/database.ts'
import type { D1Database } from '../d1/types.ts'
import { awardBadges, listHeldBadgeIds, listUserBadges } from './progress.ts'
import { createUser } from './users.ts'

describe('badges', () => {
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

  it('listHeldBadgeIds returns only that user’s badges, once each', async () => {
    let db = createD1Database(d1)
    let user = await createUser(db, { email: 'held@example.com' })
    let other = await createUser(db, { email: 'other@example.com' })
    assert.deepEqual(await listHeldBadgeIds(db, user.id), [])

    await awardBadges(db, user.id, ['first-lesson', 'streak-3'], 10)
    // Already held: ignored, keeps the first award time.
    await awardBadges(db, user.id, ['first-lesson'], 20)
    await awardBadges(db, other.id, ['course-done'], 30)

    assert.deepEqual((await listHeldBadgeIds(db, user.id)).sort(), ['first-lesson', 'streak-3'])
    assert.deepEqual(await listHeldBadgeIds(db, other.id), ['course-done'])
    assert.deepEqual(
      (await listUserBadges(db, user.id)).map((row) => [row.badge_id, row.awarded_at]),
      [
        ['first-lesson', 10],
        ['streak-3', 10],
      ],
    )
  })
})
