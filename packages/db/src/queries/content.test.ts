import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database, type D1DataTableDatabase } from '../d1/database.ts'
import {
  listCourseAuthorIds,
  listCourseVersions,
  listLiveCourses,
  listManagedCourses,
  markVersionReady,
  recordCourseBuild,
  setLiveVersion,
  type CourseBuildInput,
} from './content.ts'
import { createUser } from './users.ts'

describe('course content index', () => {
  let db: D1DataTableDatabase
  let dispose: () => Promise<void>
  let authorId: string

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    db = createD1Database(testD1.d1)
    authorId = (await createUser(db, { email: 'author@example.com', role: 'author' })).id
  })

  after(async () => {
    await dispose()
  })

  let build = (overrides: Partial<CourseBuildInput> = {}): CourseBuildInput => ({
    id: crypto.randomUUID(),
    slug: 'tokens',
    title: 'Tokens',
    track: 'Foundations',
    sort: 2,
    errors: 0,
    warnings: 0,
    report: [{ level: 'ok', text: 'course.md frontmatter valid' }],
    files: 3,
    source: 'cli',
    userId: authorId,
    now: 1_000,
    ...overrides,
  })

  it('numbers builds per course and records failed ones as reports', async () => {
    let v1 = await recordCourseBuild(db, build())
    assert.equal(v1.n, 1)
    assert.equal(v1.status, 'building')
    let v2 = await recordCourseBuild(
      db,
      build({ title: 'Broken', errors: 1, report: [{ level: 'error', text: 'no title', file: 'course.md', line: 2 }] }),
    )
    assert.equal(v2.n, 2)
    assert.equal(v2.status, 'failed')
    assert.deepEqual(v2.report[0], { level: 'error', text: 'no title', file: 'course.md', line: 2 })
    let versions = await listCourseVersions(db, 'tokens')
    assert.deepEqual(versions.map((v) => v.n), [2, 1])
    // A failed build keeps the course's last good title.
    let [course] = await listManagedCourses(db, { id: authorId, role: 'author' })
    assert.equal(course?.title, 'Tokens')
    assert.deepEqual(await listCourseAuthorIds(db, 'tokens'), [authorId])
  })

  it('publishes only ready versions, and rollback is the same pointer flip', async () => {
    assert.equal(await setLiveVersion(db, 'tokens', 1, 2_000), false, 'still building')
    assert.deepEqual(await listLiveCourses(db), [])
    let [, v1] = await listCourseVersions(db, 'tokens')
    await markVersionReady(db, v1!.id)
    assert.equal(await setLiveVersion(db, 'tokens', 2, 2_000), false, 'failed build')
    assert.equal(await setLiveVersion(db, 'tokens', 1, 2_000), true)
    let live = await listLiveCourses(db)
    assert.deepEqual(live, [{ slug: 'tokens', version_id: v1!.id, n: 1, published_at: 2_000 }])

    let v3 = await recordCourseBuild(db, build({ title: 'Tokens, again' }))
    await markVersionReady(db, v3.id)
    assert.equal(await setLiveVersion(db, 'tokens', 3, 3_000), true)
    assert.equal((await listLiveCourses(db))[0]?.n, 3)
    assert.equal(await setLiveVersion(db, 'tokens', 1, 4_000), true)
    let rolledBack = await listLiveCourses(db)
    assert.equal(rolledBack[0]?.n, 1)
    // First publish time is kept.
    assert.equal(rolledBack[0]?.published_at, 2_000)
  })

  it('admins manage every course; authors only their own', async () => {
    await recordCourseBuild(db, build({ slug: 'loops', title: 'Loops', userId: null }))
    let admin = await listManagedCourses(db, { id: 'x', role: 'admin' })
    assert.deepEqual(admin.map((c) => c.slug).sort(), ['loops', 'tokens'])
    let mine = await listManagedCourses(db, { id: authorId, role: 'author' })
    assert.deepEqual(mine.map((c) => c.slug), ['tokens'])
  })
})
