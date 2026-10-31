import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database } from '../d1/database.ts'
import type { D1Database } from '../d1/types.ts'
import { users } from '../tables.ts'
import { createUser, saveTheme } from './users.ts'

describe('the theme preference (decision 062)', () => {
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

  it('starts null (follow the system), saves dark or light, and only writes on a change', async () => {
    let db = createD1Database(d1)
    let user = await createUser(db, { email: 'theme@example.com' })
    assert.equal((await db.find(users, user.id))?.theme, null)

    assert.equal(await saveTheme(db, user.id, 'light'), true)
    assert.equal((await db.find(users, user.id))?.theme, 'light')
    assert.equal(await saveTheme(db, user.id, 'light'), false)

    assert.equal(await saveTheme(db, user.id, 'dark'), true)
    assert.equal((await db.find(users, user.id))?.theme, 'dark')

    assert.equal(await saveTheme(db, user.id, null), true)
    assert.equal((await db.find(users, user.id))?.theme, null)
    assert.equal(await saveTheme(db, user.id, null), false)
  })

  it('refuses any other value (the column check)', async () => {
    let db = createD1Database(d1)
    let user = await createUser(db, { email: 'theme-check@example.com' })
    await assert.rejects(d1.prepare(`update users set theme = 'system' where id = ?1`).bind(user.id).run())
  })
})
