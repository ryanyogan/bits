// The driver's behaviour suite, on a real workerd D1 (Miniflare). The first
// 17 cases are the checks spike S0 ran against every D1 driver for
// remix/data-table (docs/plans/build-along/s0.md §3 in the bits repo); the
// rest cover the column decoding and the binding types.
import * as assert from 'remix/assert'
import { column as c, eq, inList, like, sql, table } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../test/d1.ts'
import { createD1Database, type D1DataTableDatabase } from './database.ts'
import { D1UnsupportedError, toD1Value } from './driver.ts'

const users = table({
  name: 'users',
  columns: {
    id: c.text().primaryKey(),
    email: c.text(),
    is_public: c.boolean(),
    goals: c.json().nullable(),
    settings: c.json().nullable(),
    created_at: c.integer(),
  },
})

const notes = table({
  name: 'notes',
  columns: {
    id: c.integer().primaryKey(),
    user_id: c.text(),
    body: c.text(),
    pinned: c.boolean(),
    created_at: c.integer(),
  },
})

// The same table with an app-level afterRead that decodes the columns itself,
// as apps did before the driver decoded them. Decoding must be idempotent.
let afterReadCalls = 0
const usersWithHooks = table({
  name: 'users',
  columns: {
    id: c.text().primaryKey(),
    email: c.text(),
    is_public: c.boolean(),
    goals: c.json().nullable(),
    settings: c.json().nullable(),
    created_at: c.integer(),
  },
  afterRead({ value }) {
    afterReadCalls++
    let next = { ...value }
    if (typeof next.goals === 'string') next.goals = JSON.parse(next.goals)
    if (typeof next.is_public === 'number') next.is_public = next.is_public !== 0
    return { value: next }
  },
})

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

  // --- The S0 checks -------------------------------------------------------

  it('1. creates a row with a JSON array value', async () => {
    await db.create(users, { id: 'u0', email: 'json@example.com', is_public: false, goals: ['agents'], settings: null, created_at: 0 })
    assert.equal(await db.delete(users, 'u0'), true)
  })

  it('2. creates and finds a row (text primary key, integer timestamps)', async () => {
    await db.create(users, { id: 'u1', email: 'ada@example.com', is_public: false, goals: ['agents'], settings: null, created_at: 1 })
    let row = await db.find(users, 'u1')
    assert.equal(row?.email, 'ada@example.com')
    assert.equal(row?.created_at, 1)
  })

  it('3. reads a boolean column back as a boolean', async () => {
    let row = await db.find(users, 'u1')
    assert.equal(row?.is_public, false)
  })

  it('4. reads a json column back decoded', async () => {
    let row = await db.find(users, 'u1')
    assert.deepEqual(row?.goals, ['agents'])
  })

  it('5. returns the created row (RETURNING), decoded', async () => {
    let row = await db.create(
      users,
      { id: 'u2', email: 'grace@example.com', is_public: true, goals: null, settings: { theme: 'dark' }, created_at: 2 },
      { returnRow: true },
    )
    assert.equal(row.id, 'u2')
    assert.equal(row.is_public, true)
    assert.equal(row.goals, null)
    assert.deepEqual(row.settings, { theme: 'dark' })
  })

  it('6. reports the autoincrement insertId', async () => {
    let result = await db.create(notes, { user_id: 'u1', body: 'first', pinned: false, created_at: 3 })
    assert.equal(Number(result.insertId), 1)
  })

  it('7. creates many rows and returns them', async () => {
    let rows = await db.createMany(
      notes,
      [
        { user_id: 'u1', body: 'b', pinned: true, created_at: 4 },
        { user_id: 'u2', body: 'c', pinned: false, created_at: 5 },
      ],
      { returnRows: true },
    )
    assert.equal(rows.length, 2)
    assert.deepEqual(rows.map((row) => row.pinned), [true, false])
  })

  it('8. rejects a unique constraint violation', async () => {
    await assert.rejects(() =>
      db.create(users, { id: 'u3', email: 'ada@example.com', is_public: false, goals: null, settings: null, created_at: 6 }),
    )
  })

  it('9. filters with where, inList, like, orderBy, limit and offset', async () => {
    let rows = await db.findMany(notes, {
      where: inList('user_id', ['u1', 'u2']),
      orderBy: ['created_at', 'desc'],
      limit: 2,
      offset: 1,
    })
    assert.deepEqual(rows.map((row) => row.body), ['b', 'first'])
    let liked = await db.findMany(users, { where: like('email', '%grace%') })
    assert.equal(liked.length, 1)
  })

  it('10. counts and checks existence', async () => {
    assert.equal(await db.count(notes, { where: { user_id: 'u1' } }), 2)
    assert.equal(await db.query(notes).where({ user_id: 'nobody' }).exists(), false)
    assert.equal(await db.query(notes).where({ user_id: 'u1' }).exists(), true)
  })

  it('11. updates a row and returns it, decoded', async () => {
    let row = await db.update(users, 'u2', { email: 'g@example.com', is_public: false })
    assert.equal(row.email, 'g@example.com')
    assert.equal(row.is_public, false)
  })

  it('12. upserts with { update } and binds the values in order', async () => {
    let before = await db.count(users)
    await db
      .query(users)
      .upsert(
        { id: 'u2', email: 'g2@example.com', is_public: true, goals: null, settings: null, created_at: 2 },
        { update: { email: 'g2@example.com' } } as never,
      )
    assert.equal((await db.find(users, 'u2'))?.email, 'g2@example.com')
    assert.equal(await db.count(users), before)
  })

  it('13. cascades a delete through a foreign key', async () => {
    assert.equal(await db.delete(users, 'u2'), true)
    assert.equal(await db.count(notes, { where: { user_id: 'u2' } }), 0)
  })

  it('14. runs raw SQL through db.exec(sql`…`)', async () => {
    let result = await db.exec(sql`select count(*) as n from notes where user_id = ${'u1'}`)
    assert.equal(Number(result.rows?.[0]?.n), 2)
  })

  it('15. refuses db.transaction() and writes nothing', async () => {
    let before = await db.count(notes)
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          await tx.create(notes, { user_id: 'u1', body: 'in-tx', pinned: false, created_at: 9 })
        }),
      D1UnsupportedError,
    )
    assert.equal(await db.count(notes), before)
  })

  it('16. runs batch() atomically: a failing statement rolls back the others', async () => {
    let before = await db.count(notes)
    await assert.rejects(() =>
      db.batch([
        db.d1.prepare('insert into notes (user_id, body, created_at) values (?, ?, ?)').bind('u1', 'batched', 10),
        db.d1.prepare('insert into notes (user_id, body, created_at) values (?, ?, ?)').bind('missing-user', 'fk fails', 11),
      ]),
    )
    assert.equal(await db.count(notes), before)

    await db.batch([
      db.d1.prepare('insert into notes (user_id, body, created_at) values (?, ?, ?)').bind('u1', 'one', 12),
      db.d1.prepare('insert into notes (user_id, body, created_at) values (?, ?, ?)').bind('u1', 'two', 13),
    ])
    assert.equal(await db.count(notes), before + 2)
  })

  it('17. refuses updateMany with orderBy and limit', async () => {
    await assert.rejects(
      () => db.updateMany(notes, { body: 'x' }, { where: { user_id: 'u1' }, orderBy: ['created_at', 'asc'], limit: 1 }),
      D1UnsupportedError,
    )
  })

  // --- Column decoding -----------------------------------------------------

  it('round-trips json strings, numbers, objects and null', async () => {
    let cases: unknown[] = ['plain text', '[not json', 42, { nested: { list: [1, 2] } }, true, null]
    for (let [index, value] of cases.entries()) {
      let id = `json-${index}`
      await db.create(users, { id, email: `${id}@example.com`, is_public: false, goals: null, settings: value, created_at: 20 })
      assert.deepEqual((await db.find(users, id))?.settings, value)
      await db.delete(users, id)
    }
  })

  it('keeps text written by raw SQL that is not JSON', async () => {
    await db.d1
      .prepare('insert into users (id, email, is_public, goals, created_at) values (?, ?, ?, ?, ?)')
      .bind('raw', 'raw@example.com', 1, 'not json', 21)
      .run()
    let row = await db.find(users, 'raw')
    assert.equal(row?.goals, 'not json')
    assert.equal(row?.is_public, true)
    await db.delete(users, 'raw')
  })

  it('decodes picked columns, aliases and joined rows', async () => {
    let picked = await db.query(users).select('id', 'is_public').where({ id: 'u1' }).first()
    assert.deepEqual(picked, { id: 'u1', is_public: false })

    let aliased = await db.query(users).select({ public: 'is_public', list: 'goals' }).where({ id: 'u1' }).first()
    assert.deepEqual(aliased, { public: false, list: ['agents'] })

    let joined = await db
      .query(notes)
      .join(users, eq(notes.user_id, users.id))
      .select({ body: notes.body, pinned: notes.pinned, goals: users.goals })
      .where(eq(notes.body, 'b'))
      .first()
    assert.deepEqual(joined, { body: 'b', pinned: true, goals: ['agents'] })
  })

  it('leaves values alone for an afterRead hook that decodes them too', async () => {
    afterReadCalls = 0
    let row = await db.find(usersWithHooks, 'u1')
    assert.equal(afterReadCalls, 1)
    assert.equal(row?.is_public, false)
    assert.deepEqual(row?.goals, ['agents'])
  })

  it('normalizes values D1 cannot bind', () => {
    assert.equal(toD1Value(undefined), null)
    assert.equal(toD1Value(true), 1)
    assert.equal(toD1Value(false), 0)
    assert.equal(toD1Value(5n), 5)
    assert.equal(toD1Value(new Date(7)), 7)
    assert.equal(toD1Value({ a: 1 }), '{"a":1}')
    let bytes = new Uint8Array([1, 2])
    assert.equal(toD1Value(bytes), bytes)
  })

  it('refuses scripts, wipe() and scoped deleteMany', async () => {
    await assert.rejects(() => db.executeScript('select 1'), D1UnsupportedError)
    await assert.rejects(() => db.wipe(), D1UnsupportedError)
    await assert.rejects(
      () => db.deleteMany(notes, { where: { user_id: 'u1' }, orderBy: ['created_at', 'asc'], limit: 1 }),
      D1UnsupportedError,
    )
  })

  it('accepts a Miniflare binding without a cast', async () => {
    let { Miniflare, convertV4MiniflareOptions } = await import('miniflare')
    let mf = new Miniflare(
      convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response(null) } }', d1Databases: { DB: 'x' } }),
    )
    try {
      let other = createD1Database(await mf.getD1Database('DB'))
      let result = await other.exec(sql`select 1 as n`)
      assert.equal(result.rows?.[0]?.n, 1)
    } finally {
      await mf.dispose()
    }
  })
})
