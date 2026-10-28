// Housekeeping for the daily cron (decision 039): every row that expires,
// deleted in one D1 batch. The Worker's scheduled handler calls this through
// apps/web/app/housekeeping/; tests call it on real D1 in Miniflare.
import type { D1DataTableDatabase } from '../d1/database.ts'
import { mailDay } from './mail.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** How long each kind of row outlives its use. */
export const retention = {
  /** Spent or expired email tokens stay an hour: the per-address and per-IP mail limits count them. */
  emailTokensMs: HOUR,
  /** Signed-out prompt runs: only the hourly limits and the run checks need them (decision 019). */
  anonymousRunsMs: 7 * DAY,
  /** Daily mail counters (decision 039). */
  mailQuotaDays: 30,
  /** Author invites stay 30 days past expiry, accepted or not, for the admin page (decision 037). */
  authorInvitesMs: 30 * DAY,
  /** R2 aborts an unfinished multipart upload 7 days after it starts; the row is closed then too. */
  staleUploadMs: 7 * DAY,
}

/** An `uploading` video past R2's abort window, whose multipart upload may still need aborting. */
export interface StaleUpload {
  id: string
  r2_key: string
  upload_id: string | null
}

/** Unfinished video uploads started before `before` (at most 100 a run). */
export async function listStaleUploads(db: D1DataTableDatabase, before: number): Promise<StaleUpload[]> {
  let result = await db.d1
    .prepare(
      `select id, r2_key, upload_id from videos
       where status = 'uploading' and created_at < ? order by created_at limit 100`,
    )
    .bind(before)
    .all<StaleUpload>()
  return result.results
}

/** Rows deleted (for videos: marked failed) per table. */
export interface HousekeepingCounts {
  sessions: number
  emailTokens: number
  webauthnChallenges: number
  anonymousRuns: number
  mailQuota: number
  authorInvites: number
  staleUploads: number
}

/**
 * Deletes every expired row, in one batch:
 *
 * - sessions past `expires_at`;
 * - email tokens an hour after they expired or were spent;
 * - WebAuthn challenges past `expires_at`;
 * - signed-out prompt runs older than 7 days;
 * - mail counters older than 30 days;
 * - author invites 30 days after they expired, accepted or not;
 * - and marks `uploading` videos older than R2's 7-day abort window
 *   `failed` (the row stays: its r2_key is never reused).
 */
export async function deleteExpiredRows(db: D1DataTableDatabase, now: number): Promise<HousekeepingCounts> {
  let d1 = db.d1
  let results = await db.batch([
    d1.prepare('delete from sessions where expires_at <= ?').bind(now),
    d1
      .prepare('delete from email_tokens where expires_at <= ?1 or (used_at is not null and used_at <= ?1)')
      .bind(now - retention.emailTokensMs),
    d1.prepare('delete from webauthn_challenges where expires_at <= ?').bind(now),
    d1
      .prepare('delete from exercise_attempts where user_id is null and created_at < ?')
      .bind(now - retention.anonymousRunsMs),
    d1.prepare('delete from mail_quota where day < ?').bind(mailDay(now - retention.mailQuotaDays * DAY)),
    d1.prepare('delete from author_invites where expires_at <= ?').bind(now - retention.authorInvitesMs),
    d1
      .prepare(
        `update videos set status = 'failed', upload_id = null, updated_at = ?1
         where status = 'uploading' and created_at < ?2`,
      )
      .bind(now, now - retention.staleUploadMs),
  ])
  let changes = results.map((result) => result.meta.changes)
  return {
    sessions: changes[0] ?? 0,
    emailTokens: changes[1] ?? 0,
    webauthnChallenges: changes[2] ?? 0,
    anonymousRuns: changes[3] ?? 0,
    mailQuota: changes[4] ?? 0,
    authorInvites: changes[5] ?? 0,
    staleUploads: changes[6] ?? 0,
  }
}
