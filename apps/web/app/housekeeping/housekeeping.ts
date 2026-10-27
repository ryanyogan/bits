// The daily cron's work (decision 039): abort the R2 multipart uploads of
// videos that never finished, then delete every expired row in one D1
// batch, and log one summary line. worker.ts's `scheduled` handler calls
// it; tests call it on the test platform's real D1 and R2.
import { deleteExpiredRows, listStaleUploads, retention, type D1DataTableDatabase, type HousekeepingCounts } from '@bits/db'

import { errorFields, log } from '../log.ts'

/** The slice of the R2 binding housekeeping needs. */
export interface MultipartBucket {
  resumeMultipartUpload(key: string, uploadId: string): { abort(): Promise<void> }
}

export interface HousekeepingResult extends HousekeepingCounts {
  /** Multipart uploads aborted in R2 (the rest were already gone). */
  abortedUploads: number
  ms: number
}

export async function runHousekeeping(input: {
  db: D1DataTableDatabase
  bucket: MultipartBucket
  now?: number
  cron?: string
}): Promise<HousekeepingResult> {
  let now = input.now ?? Date.now()
  let started = Date.now()
  try {
    // R2 drops these itself after 7 days; aborting is belt and braces, and an
    // upload that is already gone just rejects (R2MultipartUpload makes no
    // promise that one still exists).
    let stale = await listStaleUploads(input.db, now - retention.staleUploadMs)
    let aborts = await Promise.allSettled(
      stale
        .filter((video) => video.upload_id)
        .map((video) => input.bucket.resumeMultipartUpload(video.r2_key, video.upload_id!).abort()),
    )
    let counts = await deleteExpiredRows(input.db, now)
    let result = {
      ...counts,
      abortedUploads: aborts.filter((outcome) => outcome.status === 'fulfilled').length,
      ms: Date.now() - started,
    }
    log('info', 'Housekeeping finished', { cron: input.cron, ...result })
    return result
  } catch (error) {
    log('error', 'Housekeeping failed', { cron: input.cron, ms: Date.now() - started, ...errorFields(error) })
    throw error
  }
}
