// Lesson videos (migration 0006, decision 029): MP4s in R2, uploaded in
// parts through the Worker. A row is `uploading` until the Worker completes
// the multipart upload, then `ready`; builds link lessons to the newest
// ready video for their `video:` path.
import type { D1DataTableDatabase } from '../d1/database.ts'
import type { UploadedPart, Video } from '../tables.ts'

/** What a build needs to link a lesson to its video. */
export interface ReadyVideo {
  id: string
  r2Key: string
  size: number
  durationS: number | null
}

function decode(row: Record<string, unknown> | null): Video | null {
  if (!row) return null
  let parts: UploadedPart[] = []
  try {
    let parsed: unknown = JSON.parse(String(row.parts ?? '[]'))
    if (Array.isArray(parsed)) parts = parsed as UploadedPart[]
  } catch {
    // Unreadable parts: the upload restarts.
  }
  return { ...(row as unknown as Video), parts }
}

export async function getVideo(db: D1DataTableDatabase, id: string): Promise<Video | null> {
  return decode(await db.d1.prepare('select * from videos where id = ?1').bind(id).first())
}

/** An unfinished upload of the same file (path and size) by this user, to resume. */
export async function findResumableVideo(
  db: D1DataTableDatabase,
  input: { courseId: string; path: string; size: number; userId: string; since: number },
): Promise<Video | null> {
  return decode(
    await db.d1
      .prepare(
        `select * from videos
         where course_id = ?1 and path = ?2 and status = 'uploading' and size = ?3 and uploaded_by = ?4 and created_at >= ?5
         order by updated_at desc limit 1`,
      )
      .bind(input.courseId, input.path, input.size, input.userId, input.since)
      .first(),
  )
}

export async function insertVideo(
  db: D1DataTableDatabase,
  video: Pick<Video, 'id' | 'course_id' | 'path' | 'r2_key' | 'upload_id' | 'size' | 'part_size' | 'uploaded_by' | 'created_at'>,
): Promise<void> {
  await db.d1
    .prepare(
      `insert into videos (id, course_id, path, status, r2_key, upload_id, size, part_size, parts, uploaded_by, created_at, updated_at)
       values (?1, ?2, ?3, 'uploading', ?4, ?5, ?6, ?7, '[]', ?8, ?9, ?9)`,
    )
    .bind(video.id, video.course_id, video.path, video.r2_key, video.upload_id, video.size, video.part_size, video.uploaded_by, video.created_at)
    .run()
}

/** Records one uploaded part (replacing an earlier try of the same part). */
export async function recordVideoPart(db: D1DataTableDatabase, id: string, part: UploadedPart, now: number): Promise<void> {
  await db.d1
    .prepare(
      `update videos set
         parts = (
           select json_group_array(json(value)) from (
             select value from json_each(videos.parts) where json_extract(value, '$.partNumber') != ?2
             union all select json_object('partNumber', ?2, 'etag', ?3)
           )
         ),
         updated_at = ?4
       where id = ?1 and status = 'uploading'`,
    )
    .bind(id, part.partNumber, part.etag, now)
    .run()
}

/** Marks an upload complete. Only an `uploading` row changes. */
export async function markVideoReady(db: D1DataTableDatabase, id: string, durationS: number | null, now: number): Promise<boolean> {
  let result = await db.d1
    .prepare(`update videos set status = 'ready', upload_id = null, duration_s = ?2, updated_at = ?3 where id = ?1 and status = 'uploading'`)
    .bind(id, durationS, now)
    .run()
  return (result.meta.changes ?? 0) > 0
}

export async function markVideoFailed(db: D1DataTableDatabase, id: string, now: number): Promise<void> {
  await db.d1.prepare(`update videos set status = 'failed', upload_id = null, updated_at = ?2 where id = ?1`).bind(id, now).run()
}

/** The newest ready video per `course/path` (one course, or all): the build's lookup. */
export async function listReadyVideos(db: D1DataTableDatabase, courseId?: string): Promise<Map<string, ReadyVideo>> {
  let { results } = await db.d1
    .prepare(
      `select id, course_id, path, r2_key, size, duration_s from videos
       where status = 'ready' and (?1 is null or course_id = ?1)
       order by updated_at asc`,
    )
    .bind(courseId ?? null)
    .all<{ id: string; course_id: string; path: string; r2_key: string; size: number; duration_s: number | null }>()
  let videos = new Map<string, ReadyVideo>()
  // Ascending, so the newest upload of a path wins.
  for (let row of results) {
    videos.set(`${row.course_id}/${row.path}`, { id: row.id, r2Key: row.r2_key, size: row.size, durationS: row.duration_s })
  }
  return videos
}

/** A ready video by id (null when unknown or unfinished): what /media serves. */
export async function getReadyVideo(db: D1DataTableDatabase, id: string): Promise<ReadyVideo | null> {
  let row = await db.d1
    .prepare(`select id, r2_key, size, duration_s from videos where id = ?1 and status = 'ready'`)
    .bind(id)
    .first<{ id: string; r2_key: string; size: number; duration_s: number | null }>()
  return row ? { id: row.id, r2Key: row.r2_key, size: row.size, durationS: row.duration_s } : null
}

/** The newest upload of each `video:` path in a course, whatever its status: the author page. */
export async function listCourseVideos(db: D1DataTableDatabase, courseId: string): Promise<Map<string, Video>> {
  let { results } = await db.d1
    .prepare(`select * from videos where course_id = ?1 and status != 'failed' order by updated_at asc`)
    .bind(courseId)
    .all<Record<string, unknown>>()
  let videos = new Map<string, Video>()
  for (let row of results) {
    let video = decode(row)!
    videos.set(video.path, video)
  }
  return videos
}
