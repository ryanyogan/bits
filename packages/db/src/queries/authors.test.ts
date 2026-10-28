import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database, type D1DataTableDatabase } from '../d1/database.ts'
import type { D1Database } from '../d1/types.ts'
import {
  acceptAuthorInvite,
  addCourseAuthor,
  demoteAuthor,
  findOpenAuthorInvite,
  insertAuthorInvite,
  readAuthorsOverview,
  removeCourseAuthor,
  revokeAuthorInvite,
} from './authors.ts'
import { createUser } from './users.ts'

describe('author roles and invites (decision 037)', () => {
  let d1: D1Database
  let db: D1DataTableDatabase
  let dispose: () => Promise<void>
  let n = 0

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    d1 = testD1.d1
    db = createD1Database(d1)
    await d1
      .prepare(
        `insert into courses (slug, title, sort, created_at, updated_at)
         values ('alpha', 'Alpha', 1, 1, 1), ('beta', 'Beta', 2, 1, 1)`,
      )
      .run()
  })

  after(async () => {
    await dispose()
  })

  async function user(role: 'learner' | 'author' | 'admin' = 'learner') {
    let created = await createUser(db, { email: `person${++n}@example.com` })
    await d1.prepare('update users set role = ? where id = ?').bind(role, created.id).run()
    return { ...created, role }
  }

  const roleOf = async (id: string) =>
    (await d1.prepare('select role from users where id = ?').bind(id).first<{ role: string }>())!.role

  const coursesOf = async (id: string) =>
    (await d1.prepare('select course_slug from course_authors where user_id = ? order by course_slug').bind(id).all<{ course_slug: string }>()).results.map(
      (row) => row.course_slug,
    )

  async function invite(adminId: string, email: string, courses: string[] = [], expiresAt = 10_000) {
    let token = `hash-${++n}`
    let ok = await insertAuthorInvite(db, { id: `invite-${n}`, tokenHash: token, email, courses, adminId, expiresAt, now: 1_000 })
    return { ok, token, id: `invite-${n - 0}` }
  }

  it('only an admin can invite; unknown courses are dropped', async () => {
    let admin = await user('admin')
    let author = await user('author')
    let target = await user()
    assert.equal((await invite(author.id, target.email)).ok, false)
    let made = await invite(admin.id, target.email.toUpperCase(), ['beta', 'nope'])
    assert.equal(made.ok, true)
    let open = await findOpenAuthorInvite(db, made.token, 2_000)
    assert.deepEqual(open?.courses, ['beta'])
    assert.equal(open?.invited_by_handle, admin.handle)
  })

  it('a new invite to the same address withdraws the older one', async () => {
    let admin = await user('admin')
    let target = await user()
    let first = await invite(admin.id, target.email)
    let second = await invite(admin.id, target.email)
    assert.equal(await findOpenAuthorInvite(db, first.token, 2_000), null)
    assert.ok(await findOpenAuthorInvite(db, second.token, 2_000))
  })

  it('accepting needs the invited address, grants author once and joins the courses', async () => {
    let admin = await user('admin')
    let target = await user()
    let other = await user()
    let made = await invite(admin.id, target.email, ['alpha', 'beta'])
    assert.equal(await acceptAuthorInvite(db, { tokenHash: made.token, userId: other.id, now: 2_000 }), false)
    assert.equal(await roleOf(other.id), 'learner')
    assert.equal(await acceptAuthorInvite(db, { tokenHash: made.token, userId: target.id, now: 2_000 }), true)
    assert.equal(await roleOf(target.id), 'author')
    assert.deepEqual(await coursesOf(target.id), ['alpha', 'beta'])
    // Single use.
    assert.equal(await acceptAuthorInvite(db, { tokenHash: made.token, userId: target.id, now: 2_001 }), false)
  })

  it('never downgrades an admin, and refuses expired or revoked invites', async () => {
    let admin = await user('admin')
    let other = await user('admin')
    let made = await invite(admin.id, other.email, ['alpha'])
    assert.equal(await acceptAuthorInvite(db, { tokenHash: made.token, userId: other.id, now: 2_000 }), true)
    assert.equal(await roleOf(other.id), 'admin')
    assert.deepEqual(await coursesOf(other.id), ['alpha'])

    let target = await user()
    let expired = await invite(admin.id, target.email, [], 1_500)
    assert.equal(await acceptAuthorInvite(db, { tokenHash: expired.token, userId: target.id, now: 2_000 }), false)
    let revoked = await invite(admin.id, target.email)
    let row = await findOpenAuthorInvite(db, revoked.token, 2_000)
    assert.equal(await revokeAuthorInvite(db, { id: row!.id, adminId: admin.id, now: 2_000 }), true)
    assert.equal(await acceptAuthorInvite(db, { tokenHash: revoked.token, userId: target.id, now: 2_000 }), false)
    assert.equal(await roleOf(target.id), 'learner')
  })

  it('demotes one step, takes a former author off every course, never the acting admin', async () => {
    let admin = await user('admin')
    let author = await user('author')
    assert.equal(await addCourseAuthor(db, { slug: 'alpha', userId: author.id, adminId: admin.id, now: 1 }), true)
    assert.equal(await demoteAuthor(db, { userId: admin.id, from: 'admin', adminId: admin.id, now: 2 }), false)
    assert.equal(await roleOf(admin.id), 'admin')
    assert.equal(await demoteAuthor(db, { userId: author.id, from: 'author', adminId: author.id, now: 2 }), false)
    assert.equal(await demoteAuthor(db, { userId: author.id, from: 'author', adminId: admin.id, now: 2 }), true)
    assert.equal(await roleOf(author.id), 'learner')
    assert.deepEqual(await coursesOf(author.id), [])

    let other = await user('admin')
    assert.equal(await demoteAuthor(db, { userId: other.id, from: 'admin', adminId: admin.id, now: 2 }), true)
    assert.equal(await roleOf(other.id), 'author')
  })

  it('adds only authors and admins to courses, and removes them', async () => {
    let admin = await user('admin')
    let learner = await user()
    let author = await user('author')
    assert.equal(await addCourseAuthor(db, { slug: 'beta', userId: learner.id, adminId: admin.id, now: 1 }), false)
    assert.equal(await addCourseAuthor(db, { slug: 'nope', userId: author.id, adminId: admin.id, now: 1 }), false)
    assert.equal(await addCourseAuthor(db, { slug: 'beta', userId: author.id, adminId: author.id, now: 1 }), false)
    assert.equal(await addCourseAuthor(db, { slug: 'beta', userId: author.id, adminId: admin.id, now: 1 }), true)
    let overview = await readAuthorsOverview(db, 2_000)
    assert.ok(overview.courses.find((c) => c.slug === 'beta')?.authors.some((a) => a.id === author.id))
    assert.ok(overview.people.some((p) => p.id === author.id))
    assert.ok(!overview.people.some((p) => p.id === learner.id))
    assert.equal(await removeCourseAuthor(db, { slug: 'beta', userId: author.id, adminId: admin.id }), true)
    assert.equal(await removeCourseAuthor(db, { slug: 'beta', userId: author.id, adminId: admin.id }), false)
  })
})
