import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createUser, findUserByEmail, findUserByHandle, findUserById } from '../queries/users.ts'
import { sessions, users } from '../tables.ts'
import { createD1Database, type D1DataTableDatabase } from './database.ts'
import { D1UnsupportedError } from './driver.ts'

describe('D1 data-table driver', () => {
  let db: D1DataTableDatabase
  let dispose: () => Promise<void>

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    db = createD1Database(testD1.d1)
  })

  after(async () => {
    await dispose()
  })

  it('creates and reads a user with decoded JSON and boolean columns', async () => {
    let user = await createUser(db, {
      email: '  Ada@Example.com ',
      displayName: 'Ada Lovelace',
      goals: ['agents', 'prompting'],
      timezone: 'Europe/London',
    })

    assert.equal(user.email, 'ada@example.com')
    assert.equal(user.handle, 'ada_lovelace')
    assert.deepEqual(user.goals, ['agents', 'prompting'])
    assert.equal(user.is_public, true)
    assert.equal(user.role, 'learner')
    assert.equal(typeof user.created_at, 'number')

    let byId = await findUserById(db, user.id)
    assert.deepEqual(byId, user)
    assert.equal((await findUserByEmail(db, 'ADA@example.com'))?.id, user.id)
    assert.equal((await findUserByHandle(db, 'Ada_Lovelace'))?.id, user.id)
  })

  it('enforces unique email', async () => {
    await assert.rejects(() => createUser(db, { email: 'ada@example.com', handle: 'other' }))
  })

  it('updates, counts and cascades deletes through foreign keys', async () => {
    let user = await createUser(db, { email: 'grace@example.com', displayName: 'Grace' })
    await db.create(sessions, {
      id: 'hash',
      user_id: user.id,
      expires_at: Date.now() + 1000,
      created_at: Date.now(),
      last_seen_at: Date.now(),
      user_agent: null,
    })

    let updated = await db.update(users, user.id, { is_public: false, xp_total: 40 })
    assert.equal(updated.is_public, false)
    assert.equal(updated.xp_total, 40)
    assert.equal(await db.count(sessions, { where: { user_id: user.id } }), 1)

    assert.equal(await db.delete(users, user.id), true)
    assert.equal(await db.count(sessions, { where: { user_id: user.id } }), 0)
  })

  it('runs atomic batches and rejects interactive transactions', async () => {
    await assert.rejects(() => db.transaction(async () => {}), D1UnsupportedError)

    let user = await createUser(db, { email: 'linus@example.com' })
    await db.batch([
      db.d1.prepare('update users set xp_total = xp_total + ? where id = ?').bind(10, user.id),
      db.d1.prepare('update users set xp_total = xp_total + ? where id = ?').bind(5, user.id),
    ])
    assert.equal((await findUserById(db, user.id))?.xp_total, 15)
  })
})
