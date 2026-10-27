import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database, type D1DataTableDatabase } from '../d1/database.ts'
import {
  listCourseAuthorIds,
  listCourseVersions,
  listLiveCourses,
  listManagedCourses,
  listNewestVersions,
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
  let otherId: string

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    db = createD1Database(testD1.d1)
    authorId = (await createUser(db, { email: 'author@example.com', role: 'author' })).id
    otherId = (await createUser(db, { email: 'other@example.com', role: 'author' })).id
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
    trusted: false,
    now: 1_000,
    ...overrides,
  })

  async function record(input: CourseBuildInput) {
    let version = await recordCourseBuild(db, input)
    assert.ok(version, `${input.slug} should be recorded`)
    return version
  }

  it('numbers builds per course and records failed ones as reports', async () => {
    let v1 = await record(build())
    assert.equal(v1.n, 1)
    assert.equal(v1.status, 'building')
    let v2 = await record(
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

    let v3 = await record(build({ title: 'Tokens, again' }))
    await markVersionReady(db, v3.id)
    assert.equal(await setLiveVersion(db, 'tokens', 3, 3_000), true)
    assert.equal((await listLiveCourses(db))[0]?.n, 3)
    assert.equal(await setLiveVersion(db, 'tokens', 1, 4_000), true)
    let rolledBack = await listLiveCourses(db)
    assert.equal(rolledBack[0]?.n, 1)
    // First publish time is kept.
    assert.equal(rolledBack[0]?.published_at, 2_000)

    // The newest build per course (decision 036): v3, no longer live.
    let newest = await listNewestVersions(db)
    assert.deepEqual(newest.get('tokens'), { slug: 'tokens', id: v3.id, n: 3, status: 'ready', published_at: 3_000, live: false })
    assert.equal(await setLiveVersion(db, 'tokens', 3, 5_000), true)
    assert.equal((await listNewestVersions(db)).get('tokens')?.live, true)
  })

  it('admins manage every course; authors only their own', async () => {
    await record(build({ slug: 'loops', title: 'Loops', userId: null, trusted: true }))
    let admin = await listManagedCourses(db, { id: 'x', role: 'admin' })
    assert.deepEqual(admin.map((c) => c.slug).sort(), ['loops', 'tokens'])
    let mine = await listManagedCourses(db, { id: authorId, role: 'author' })
    assert.deepEqual(mine.map((c) => c.slug), ['tokens'])
  })

  it('another author can neither build nor rename a course they don’t own', async () => {
    let before = await listCourseVersions(db, 'tokens')
    assert.equal(await recordCourseBuild(db, build({ title: 'Hijacked', userId: otherId })), null)
    assert.equal(await recordCourseBuild(db, build({ slug: 'loops', title: 'Hijacked', userId: otherId })), null)
    assert.equal((await listCourseVersions(db, 'tokens')).length, before.length, 'no version left behind')
    assert.deepEqual(await listCourseAuthorIds(db, 'tokens'), [authorId])
    assert.deepEqual(await listCourseAuthorIds(db, 'loops'), [])
    let [tokens] = await listManagedCourses(db, { id: authorId, role: 'author' })
    assert.notEqual(tokens?.title, 'Hijacked')
    // Trusted (admin, CLI) builds still work and make the uploader an author.
    await record(build({ slug: 'loops', title: 'Loops', userId: otherId, trusted: true }))
    assert.deepEqual(await listCourseAuthorIds(db, 'loops'), [otherId])
  })

  it('two racing first uploads of a new slug: exactly one claims it', async () => {
    let results = await Promise.all([
      recordCourseBuild(db, build({ slug: 'race', title: 'Race A', userId: authorId })),
      recordCourseBuild(db, build({ slug: 'race', title: 'Race B', userId: otherId })),
    ])
    let recorded = results.filter((version) => version !== null)
    assert.equal(recorded.length, 1)
    let authors = await listCourseAuthorIds(db, 'race')
    assert.equal(authors.length, 1)
    assert.equal(recorded[0]!.created_by, authors[0])
    assert.equal((await listCourseVersions(db, 'race')).length, 1)
  })
})
