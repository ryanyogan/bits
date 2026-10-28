import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { createTestD1 } from '../../test/d1.ts'
import { createD1Database, type D1DataTableDatabase } from '../d1/database.ts'
import type { D1Database } from '../d1/types.ts'
import { deleteExpiredRows, listStaleUploads, retention } from './housekeeping.ts'
import { mailDay, readMailQuota, reserveMailSend } from './mail.ts'
import { createUser } from './users.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// One flat suite: remix test runs after() around every describe.
describe('mail quota and housekeeping (decision 039)', () => {
  let d1: D1Database
  let db: D1DataTableDatabase
  let dispose: () => Promise<void>

  before(async () => {
    let testD1 = await createTestD1()
    dispose = testD1.dispose
    d1 = testD1.d1
    db = createD1Database(d1)
  })

  after(async () => {
    await dispose()
  })

  it('reserves sends up to the cap, then refuses, flagging only the first refusal', async () => {
    let now = Date.UTC(2026, 9, 27, 12)
    for (let i = 0; i < 3; i++) assert.deepEqual(await reserveMailSend(db, { now, cap: 3 }), { ok: true })
    assert.deepEqual(await reserveMailSend(db, { now, cap: 3 }), { ok: false, firstRefusal: true })
    assert.deepEqual(await reserveMailSend(db, { now: now + 1, cap: 3 }), { ok: false, firstRefusal: false })
    let row = await readMailQuota(db, now)
    assert.equal(row?.sent, 3)
    assert.equal(row?.capped_at, now)
    // A new UTC day starts from zero.
    assert.deepEqual(await reserveMailSend(db, { now: now + DAY, cap: 3 }), { ok: true })
  })

  it('never lets parallel requests pass the cap', async () => {
    let now = Date.UTC(2026, 9, 20, 9)
    let results = await Promise.all(Array.from({ length: 20 }, () => reserveMailSend(db, { now, cap: 5 })))
    assert.equal(results.filter((result) => result.ok).length, 5)
    assert.equal(results.filter((result) => !result.ok && result.firstRefusal).length, 1)
    assert.equal((await readMailQuota(db, now))?.sent, 5)
  })

  it('refuses everything with a cap of 0, and still logs the crossing once', async () => {
    let now = Date.UTC(2026, 9, 21, 9)
    assert.deepEqual(await reserveMailSend(db, { now, cap: 0 }), { ok: false, firstRefusal: true })
    assert.deepEqual(await reserveMailSend(db, { now, cap: 0 }), { ok: false, firstRefusal: false })
    assert.equal((await readMailQuota(db, now))?.sent, 0)
  })

  it('deletes expired rows in one batch and keeps live ones', async () => {
    let now = Date.UTC(2026, 9, 27, 4, 17)
    let user = await createUser(db, { email: 'keep@example.com' })
    let token = (hash: string, expiresAt: number, usedAt: number | null, purpose = 'sign-in') =>
      d1
        .prepare(
          `insert into email_tokens (token_hash, code_hash, email, attempts, expires_at, used_at, created_at, purpose, user_id)
           values (?, 'c', 'a@example.com', 0, ?, ?, ?, ?, ?)`,
        )
        .bind(hash, expiresAt, usedAt, expiresAt - 15 * 60 * 1000, purpose, purpose === 'sign-in' ? null : user.id)
    let session = (id: string, expiresAt: number) =>
      d1
        .prepare(
          `insert into sessions (id, user_id, data, user_agent, expires_at, created_at, last_seen_at)
           values (?, null, '[{}, {}]', null, ?, 0, 0)`,
        )
        .bind(id, expiresAt)
    let challenge = (id: string, expiresAt: number) =>
      d1
        .prepare(`insert into webauthn_challenges (challenge, purpose, user_id, expires_at, created_at) values (?, 'sign-in', null, ?, 0)`)
        .bind(id, expiresAt)
    let run = (id: string, userId: string | null, createdAt: number) =>
      d1
        .prepare(
          `insert into exercise_attempts (id, user_id, visitor, course_id, lesson_slug, exercise_id, prompt, source, created_at)
           values (?, ?, 'v', 'c', 'l', 'e', 'p', 'example', ?)`,
        )
        .bind(id, userId, createdAt)
    let video = (id: string, status: string, createdAt: number) =>
      d1
        .prepare(
          `insert into videos (id, course_id, path, status, r2_key, upload_id, size, part_size, parts, created_at, updated_at)
           values (?, 'c', 'a.mp4', ?, ?, 'up-' || ?, 10, 10, '[]', ?, ?)`,
        )
        .bind(id, status, `videos/${id}.mp4`, id, createdAt, createdAt)
    let quota = (day: string) => d1.prepare('insert into mail_quota (day, sent) values (?, 1)').bind(day)
    let invite = (id: string, expiresAt: number, acceptedAt: number | null = null) =>
      d1
        .prepare(
          `insert into author_invites (id, token_hash, email, courses, invited_by, expires_at, accepted_at, created_at)
           values (?1, 'h-' || ?1, 'invitee@example.com', '[]', null, ?2, ?3, ?2 - 7 * 86400000)`,
        )
        .bind(id, expiresAt, acceptedAt)

    await db.batch([
      session('s-old', now - 1),
      session('s-live', now + DAY),
      token('t-expired', now - 2 * HOUR, null),
      token('t-spent', now + 10 * 60 * 1000, now - 2 * HOUR),
      token('t-just-spent', now + 10 * 60 * 1000, now - 10 * 60 * 1000),
      token('t-expired-recently', now - 10 * 60 * 1000, null),
      token('t-revert-open', now + 6 * DAY, null, 'email-revert'),
      challenge('c-old', now - 1),
      challenge('c-live', now + 60_000),
      run('r-anon-old', null, now - 8 * DAY),
      run('r-anon-new', null, now - DAY),
      run('r-user-old', user.id, now - 30 * DAY),
      video('v-stale', 'uploading', now - 8 * DAY),
      video('v-fresh', 'uploading', now - DAY),
      video('v-ready', 'ready', now - 30 * DAY),
      quota(mailDay(now - 31 * DAY)),
      quota(mailDay(now - 29 * DAY)),
      invite('i-expired-long-ago', now - 31 * DAY),
      invite('i-accepted-long-ago', now - 31 * DAY, now - 35 * DAY),
      invite('i-expired-recently', now - 29 * DAY),
      invite('i-open', now + 6 * DAY),
    ])

    let stale = await listStaleUploads(db, now - retention.staleUploadMs)
    assert.deepEqual(
      stale.map((row) => [row.id, row.upload_id]),
      [['v-stale', 'up-v-stale']],
    )

    let counts = await deleteExpiredRows(db, now)
    assert.deepEqual(counts, {
      sessions: 1,
      emailTokens: 2,
      webauthnChallenges: 1,
      anonymousRuns: 1,
      mailQuota: 1,
      authorInvites: 2,
      staleUploads: 1,
    })

    let ids = async (sql: string) => (await d1.prepare(sql).all<{ id: string }>()).results.map((row) => row.id).sort()
    assert.deepEqual(await ids('select id from sessions'), ['s-live'])
    assert.deepEqual(await ids('select token_hash as id from email_tokens'), [
      't-expired-recently',
      't-just-spent',
      't-revert-open',
    ])
    assert.deepEqual(await ids('select challenge as id from webauthn_challenges'), ['c-live'])
    assert.deepEqual(await ids('select id from exercise_attempts'), ['r-anon-new', 'r-user-old'])
    let videos = (await d1.prepare('select id, status, upload_id from videos order by id').all()).results
    assert.deepEqual(videos, [
      { id: 'v-fresh', status: 'uploading', upload_id: 'up-v-fresh' },
      { id: 'v-ready', status: 'ready', upload_id: 'up-v-ready' },
      { id: 'v-stale', status: 'failed', upload_id: null },
    ])
    assert.equal(await readMailQuota(db, now - 31 * DAY), null)
    assert.notEqual(await readMailQuota(db, now - 29 * DAY), null)
    assert.deepEqual(await ids('select id from author_invites'), ['i-expired-recently', 'i-open'])

    // A second run finds nothing left to do.
    let again = await deleteExpiredRows(db, now)
    assert.equal(Object.values(again).reduce((sum, n) => sum + n, 0), 0)
  })
})
