// The daily cron's work (decision 039), on the test platform's real D1 and
// R2 (Miniflare), without a cron: the scheduled handler only adds bindings.
import { insertVideo, getVideo } from '@bits/db'
import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { disposePlatform, platform } from '#platform'

import { testDb } from '../test/auth.ts'
import { videoKey } from '../video/keys.ts'
import { runHousekeeping } from './housekeeping.ts'

const DAY = 24 * 60 * 60 * 1000

// One flat suite: remix test runs after() around every describe.
describe('housekeeping', () => {
  after(() => disposePlatform())

  it('aborts stale multipart uploads, closes their rows, deletes expired rows and logs one summary', async () => {
    let now = Date.now()
    let bucket = platform.env.CONTENT
    let staleId = '00000000-0000-4000-8000-000000000391'
    let freshId = '00000000-0000-4000-8000-000000000392'
    let stale = await bucket.createMultipartUpload(videoKey(staleId))
    let fresh = await bucket.createMultipartUpload(videoKey(freshId))
    let row = { course_id: 'tokens-and-temperature', path: 'assets/x.mp4', size: 10, part_size: 10, uploaded_by: null }
    await insertVideo(testDb, { ...row, id: staleId, r2_key: stale.key, upload_id: stale.uploadId, created_at: now - 8 * DAY })
    await insertVideo(testDb, { ...row, id: freshId, r2_key: fresh.key, upload_id: fresh.uploadId, created_at: now - DAY })
    await testDb.d1
      .prepare(
        `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
         values ('housekeeping-expired', null, '[{}, {}]', null, ?, 0, 0)`,
      )
      .bind(now - 1)
      .run()

    let lines: Record<string, unknown>[] = []
    let original = console.info
    console.info = (line: unknown) => lines.push(JSON.parse(String(line)))
    let result
    try {
      result = await runHousekeeping({ db: testDb, bucket, now, cron: '17 4 * * *' })
    } finally {
      console.info = original
    }

    assert.equal(result.abortedUploads, 1)
    assert.equal(result.staleUploads, 1)
    assert.ok(result.sessions >= 1)
    assert.equal((await getVideo(testDb, staleId))?.status, 'failed')
    assert.equal((await getVideo(testDb, freshId))?.status, 'uploading')
    // The aborted upload takes no more parts; the fresh one still does.
    await assert.rejects(() => bucket.resumeMultipartUpload(stale.key, stale.uploadId).uploadPart(1, new Uint8Array(10)))
    let part = await fresh.uploadPart(1, new Uint8Array(10))
    await fresh.complete([part])

    assert.equal(lines.length, 1)
    assert.equal(lines[0]!.message, 'Housekeeping finished')
    assert.equal(lines[0]!.cron, '17 4 * * *')
    assert.equal(lines[0]!.staleUploads, 1)
  })

  it('logs an error and rethrows when the batch fails, so the cron invocation shows as failed', async () => {
    let broken = {
      d1: {
        prepare() {
          throw new Error('D1 is down')
        },
      },
    } as unknown as typeof testDb
    let lines: Record<string, unknown>[] = []
    let original = console.error
    console.error = (line: unknown) => lines.push(JSON.parse(String(line)))
    try {
      await assert.rejects(() => runHousekeeping({ db: broken, bucket: platform.env.CONTENT, cron: '17 4 * * *' }), /D1 is down/)
    } finally {
      console.error = original
    }
    assert.equal(lines[0]!.message, 'Housekeeping failed')
  })
})
