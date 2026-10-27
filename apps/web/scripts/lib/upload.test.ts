import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { createD1Database, listCourseVersions, type D1DataTableDatabase } from '@bits/db'
import { applyMigrations } from '@bits/db/test/migrations'
import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'
import { getPlatformProxy } from 'wrangler'

import { hasVideo } from '../../app/actions/courses/lesson/content.ts'
import { publishVersion } from '../../app/content/store.ts'
import { seedTestVideo, testVideo } from '../../app/test/videos.ts'
import { coursesDir } from './content-folder.ts'
import { readConfigShape } from './preview-resources.ts'
import { uploadCourseFolder, type UploadOptions } from './upload.ts'

// Decision 036: CI uploads every course on every push; only a changed build
// (sources, compiler output or linked videos) may become a new version.
describe('uploadCourseFolder', () => {
  let tmp: string
  let dispose: () => Promise<void>
  let db: D1DataTableDatabase
  let bucket: R2Bucket
  let course: string
  const slug = testVideo.course

  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bits-upload-test-'))
    // Its own in-memory D1 and R2, not the test platform's: only DB and CONTENT.
    let config = readConfigShape(path.resolve(import.meta.dirname, '../../wrangler.jsonc'))
    let configPath = path.join(tmp, 'wrangler.json')
    await fs.writeFile(
      configPath,
      JSON.stringify({
        name: 'bits-upload-test',
        compatibility_date: config.compatibility_date,
        d1_databases: [{ binding: 'DB', database_name: 'test', database_id: 'test' }],
        r2_buckets: [{ binding: 'CONTENT', bucket_name: 'test' }],
      }),
    )
    let proxy = await getPlatformProxy<Env>({ configPath, persist: false })
    dispose = proxy.dispose
    await applyMigrations(proxy.env.DB)
    db = createD1Database(proxy.env.DB)
    bucket = proxy.env.CONTENT
    // A copy of the course with the Temperature video, so the test can edit it.
    course = path.join(tmp, slug)
    await fs.cp(path.join(coursesDir, slug), course, { recursive: true })
  })

  after(async () => {
    await dispose()
    await fs.rm(tmp, { recursive: true, force: true })
  })

  let upload = (options: Partial<UploadOptions> = {}) => uploadCourseFolder(db, bucket, course, { source: 'test', publish: true, ...options })
  let versionCount = async () => (await listCourseVersions(db, slug)).length

  it('saves and publishes a new course, then skips it while nothing changes', async () => {
    let first = await upload()
    assert.equal(first.outcome, 'created')
    assert.equal(first.version.n, 1)
    assert.equal(first.published, true)

    let again = await upload()
    assert.equal(again.outcome, 'unchanged')
    assert.equal(again.version.n, 1)
    assert.equal(again.live, true)
    assert.equal(again.published, false)
    assert.equal(await versionCount(), 1)
  })

  it('saves a new version when a lesson video becomes ready (the link changes)', async () => {
    await seedTestVideo(db, bucket)
    let result = await upload()
    assert.equal(result.outcome, 'created')
    assert.equal(result.version.n, 2)
    assert.ok([...(result.build.lessons?.values() ?? [])].some(hasVideo))
    assert.equal((await upload()).outcome, 'unchanged')
    assert.equal(await versionCount(), 2)
  })

  it('saves a new version when a source changes', async () => {
    let file = path.join(course, 'course.md')
    let text = await fs.readFile(file, 'utf8')
    await fs.writeFile(file, text.replace(/^title: .*$/m, 'title: Tokens & temperature, edited'))
    let result = await upload({ publish: false })
    assert.equal(result.outcome, 'created')
    assert.equal(result.version.n, 3)
    assert.equal(result.live, false)
  })

  it('publishes a matching version that was never live, without saving another', async () => {
    let result = await upload()
    assert.equal(result.outcome, 'unchanged')
    assert.equal(result.version.n, 3)
    assert.equal(result.published, true)
    assert.equal(await versionCount(), 3)
  })

  it('leaves a rollback alone until the course changes', async () => {
    assert.equal(await publishVersion(db, slug, 2), true)
    let result = await upload()
    assert.equal(result.outcome, 'rolled-back')
    assert.equal(result.published, false)
    assert.equal(await versionCount(), 3)
    let live = (await listCourseVersions(db, slug)).find((version) => version.n === 2)
    assert.ok(live?.published_at)
  })

  it('saves anyway with force', async () => {
    let result = await upload({ force: true })
    assert.equal(result.outcome, 'created')
    assert.equal(result.version.n, 4)
    assert.equal(result.published, true)
  })

  it('records a build with errors as a failed version, every time', async () => {
    let broken = path.resolve(coursesDir, '../fixtures/broken-course')
    let options = { source: 'test', publish: true }
    let first = await uploadCourseFolder(db, bucket, broken, options)
    let second = await uploadCourseFolder(db, bucket, broken, options)
    assert.equal(first.version.status, 'failed')
    assert.equal(second.outcome, 'created')
    assert.equal(second.version.n, first.version.n + 1)
    assert.equal(second.published, false)
  })
})
