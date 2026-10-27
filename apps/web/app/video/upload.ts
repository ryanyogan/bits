// Lesson video uploads (decision 029): the author's browser sends an MP4 to
// R2 in parts through the Worker, using the R2 binding's multipart API, so
// no S3 keys exist anywhere and every part stays far under the Workers
// request-body limit (100 MB). The Worker completes the upload itself and
// marks the `videos` row ready; there is no webhook.
//
//   POST /api/author/videos                 course, path, size → { id, partSize, parts, done }
//   PUT  /api/author/videos/:id/parts/:n    raw bytes of part n (1-based)
//   POST /api/author/videos/:id/complete    duration (seconds, from the file)
//
// A broken upload resumes: starting again with the same course, path and
// size finds the unfinished row and answers with the parts already stored.
import {
  findCourse,
  findResumableVideo,
  getVideo,
  insertVideo,
  listCourseAuthorIds,
  markVideoFailed,
  markVideoReady,
  recordVideoPart,
  type User,
  type Video,
} from '@bits/db'
import type { RequestContext } from 'remix/router'

import { canAuthor, currentUser } from '../auth/identity.ts'
import { canManageCourse } from '../actions/author/data.ts'
import { contentBucket } from '../content/request.ts'
import { log } from '../log.ts'
import { getDatabase } from '../middleware/database.ts'
import { routes } from '../routes.ts'
import { videoHref, videoKey } from './keys.ts'

/** 10 MiB: R2 needs at least 5 MiB per part (all but the last the same size). */
export const PART_SIZE = 10 * 1024 * 1024
/** A 5–8 minute lesson is a few hundred MB at most; this leaves room. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024
/** Three hours. */
const MAX_DURATION_S = 3 * 60 * 60
/** R2 drops unfinished multipart uploads after 7 days; resume within 6. */
const RESUME_WINDOW_MS = 6 * 24 * 60 * 60 * 1000

export { videoHref, videoKey }


function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function partCount(video: Pick<Video, 'size' | 'part_size'>): number {
  return Math.ceil(video.size / video.part_size)
}

function partLength(video: Pick<Video, 'size' | 'part_size'>, n: number): number {
  return n < partCount(video) ? video.part_size : video.size - video.part_size * (n - 1)
}

/** The signed-in author who manages `courseId`, or the error response. */
async function authorOf(context: RequestContext<any, any>, courseId: string): Promise<User | Response> {
  let user = currentUser(context)
  if (!user) return json({ error: 'sign_in_required' }, 401)
  if (!canAuthor(user)) return json({ error: 'forbidden' }, 403)
  let db = getDatabase(context)
  if (!(await findCourse(db, courseId))) {
    return json({ error: 'unknown_course', message: 'Upload the course folder first, then its videos.' }, 404)
  }
  if (!canManageCourse(user, { ownerIds: await listCourseAuthorIds(db, courseId) })) return json({ error: 'forbidden' }, 403)
  return user
}

/** An `uploading` video this user may write to, or the error response. */
async function uploadOf(context: RequestContext<any, any>, id: string): Promise<{ user: User; video: Video } | Response> {
  let video = await getVideo(getDatabase(context), id)
  if (!video) return json({ error: 'not_found' }, 404)
  let user = await authorOf(context, video.course_id)
  if (user instanceof Response) return user
  if (video.status !== 'uploading' || !video.upload_id) return json({ error: 'not_uploading', status: video.status }, 409)
  return { user, video }
}

function uploadState(video: Video) {
  return {
    id: video.id,
    partSize: video.part_size,
    parts: partCount(video),
    done: video.parts.map((part) => part.partNumber).sort((a, b) => a - b),
  }
}

/** A lesson `video:` path: a folder-relative .mp4, no dot segments. */
function cleanVideoPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let parts = value.replace(/\\/g, '/').replace(/^\.\//, '').split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part.startsWith('.'))) return undefined
  let path = parts.join('/')
  return path.length <= 200 && /\.mp4$/i.test(path) ? path : undefined
}

export async function startVideoUpload(context: RequestContext<any, any>): Promise<Response> {
  let form = context.get(FormData) as FormData
  let courseId = String(form.get('course') ?? '')
  let path = cleanVideoPath(form.get('path'))
  let size = Number(form.get('size'))
  if (!courseId || !path) return json({ error: 'invalid', message: 'Videos are MP4 files named by a lesson’s video: path.' }, 422)
  if (!Number.isInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return json({ error: 'invalid', message: 'Videos can be up to 2 GB.' }, 422)
  }
  let user = await authorOf(context, courseId)
  if (user instanceof Response) return user

  let db = getDatabase(context)
  let now = Date.now()
  let existing = await findResumableVideo(db, { courseId, path, size, userId: user.id, since: now - RESUME_WINDOW_MS })
  if (existing) return json(uploadState(existing))

  let id = crypto.randomUUID()
  let upload = await contentBucket().createMultipartUpload(videoKey(id), {
    httpMetadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { course: courseId, path },
  })
  await insertVideo(db, {
    id,
    course_id: courseId,
    path,
    r2_key: videoKey(id),
    upload_id: upload.uploadId,
    size,
    part_size: PART_SIZE,
    uploaded_by: user.id,
    created_at: now,
  })
  log('info', 'Video upload started', { video: id, course: courseId, path, size })
  return json(uploadState({ ...(await getVideo(db, id))! }), 201)
}

export async function uploadVideoPart(context: RequestContext<any, any>): Promise<Response> {
  let found = await uploadOf(context, String(context.params.id))
  if (found instanceof Response) return found
  let { video } = found
  let n = Number(context.params.part)
  if (!Number.isInteger(n) || n < 1 || n > partCount(video)) return json({ error: 'invalid_part' }, 422)
  let expected = partLength(video, n)
  let declared = Number(context.request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > expected) return json({ error: 'part_size', expected }, 413)
  // Content-Length can be absent or wrong, so the read itself stops past the
  // part's length: at most PART_SIZE (10 MiB) in memory. A buffer also gives
  // R2 the exact length.
  let bytes = await readAtMost(context.request, expected)
  if (!bytes) return json({ error: 'part_size', expected }, 413)
  if (bytes.byteLength !== expected) return json({ error: 'part_size', expected, got: bytes.byteLength }, 422)

  let upload = contentBucket().resumeMultipartUpload(video.r2_key, video.upload_id!)
  let part = await upload.uploadPart(n, bytes)
  await recordVideoPart(getDatabase(context), video.id, { partNumber: part.partNumber, etag: part.etag }, Date.now())
  return json({ part: n })
}

export async function completeVideoUpload(context: RequestContext<any, any>): Promise<Response> {
  let found = await uploadOf(context, String(context.params.id))
  if (found instanceof Response) return found
  let { video } = found
  let form = context.get(FormData) as FormData
  let duration = Math.round(Number(form.get('duration')))
  let durationS = Number.isFinite(duration) && duration > 0 && duration <= MAX_DURATION_S ? duration : null

  let parts = [...video.parts].sort((a, b) => a.partNumber - b.partNumber)
  let missing = Array.from({ length: partCount(video) }, (_, i) => i + 1).filter((n) => !parts.some((p) => p.partNumber === n))
  if (missing.length) return json({ error: 'parts_missing', missing }, 409)

  let db = getDatabase(context)
  try {
    let object = await contentBucket().resumeMultipartUpload(video.r2_key, video.upload_id!).complete(parts)
    if (object.size !== video.size) throw new Error(`size ${object.size} != ${video.size}`)
  } catch (error) {
    await markVideoFailed(db, video.id, Date.now())
    log('error', 'Video upload failed to complete', { video: video.id, message: String(error) })
    return json({ error: 'complete_failed', message: 'The upload didn’t finish. Start it again.' }, 422)
  }
  await markVideoReady(db, video.id, durationS, Date.now())
  log('info', 'Video upload ready', { video: video.id, course: video.course_id, path: video.path })
  return json({ id: video.id, status: 'ready', src: videoHref(video.id), duration: durationS })
}

/** The request body, or null as soon as it runs past `limit` bytes. */
async function readAtMost(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0)
  let reader = request.body.getReader()
  let buffer = new Uint8Array(limit)
  let length = 0
  while (true) {
    let { done, value } = await reader.read()
    if (done || !value) return buffer.subarray(0, length)
    if (length + value.byteLength > limit) {
      await reader.cancel()
      return null
    }
    buffer.set(value, length)
    length += value.byteLength
  }
}
