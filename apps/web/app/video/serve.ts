// GET /media/videos/:id.mp4 (decision 029): a ready lesson video from R2,
// with Range support so <video> can seek and stream. The bucket stays
// private (it also holds unpublished course builds); this route is the only
// way to the files. Objects only appear in R2 once the Worker completes their
// multipart upload, so an object that exists is a finished video, and no D1
// lookup is needed. Keys are random per upload and never rewritten, so the
// response is immutable.
import type { R2Object, R2ObjectBody, R2Range } from '@cloudflare/workers-types/index.ts'
import type { RequestContext } from 'remix/router'

import { contentBucket } from '../content/request.ts'
import { videoKey } from './keys.ts'

const IMMUTABLE = 'public, max-age=31536000, immutable'
const ID = /^[0-9a-f-]{36}$/

/**
 * Cheap hotlink guard: browsers mark a cross-site media request with
 * `Sec-Fetch-Site: cross-site`, and send another site's Referer. A request
 * without either (curl, a direct visit) is let through; the file is public
 * content anyway, this only stops other sites embedding it. The response's
 * `Cross-Origin-Resource-Policy: same-origin` makes browsers refuse it on
 * other origins as well.
 */
export function isHotlink(request: Request): boolean {
  let site = request.headers.get('Sec-Fetch-Site')
  if (site === 'cross-site') return true
  let referer = request.headers.get('Referer')
  if (!referer) return false
  try {
    return new URL(referer).host !== new URL(request.url).host
  } catch {
    return true
  }
}

/**
 * One `bytes=` range as R2 takes it: `a-b`, `a-` or `-n`. Undefined for no
 * header; null for one we don't serve (several ranges, other units).
 */
export function parseRange(header: string | null): R2Range | undefined | null {
  if (!header) return undefined
  let match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return null
  if (!match[1]) return { suffix: Number(match[2]) }
  let offset = Number(match[1])
  if (!match[2]) return { offset }
  let end = Number(match[2])
  return end < offset ? null : { offset, length: end - offset + 1 }
}

function unsatisfiable(size?: number) {
  let headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (size !== undefined) headers['Content-Range'] = `bytes */${size}`
  return new Response('Range not satisfiable', { status: 416, headers })
}

export async function serveVideo(context: RequestContext<any, any>): Promise<Response> {
  let id = String(context.params.id)
  if (!ID.test(id)) return new Response('Not found', { status: 404 })
  if (isHotlink(context.request)) return new Response('Forbidden', { status: 403 })

  let headers = context.request.headers
  let range = parseRange(headers.get('Range'))
  if (range === null) return unsatisfiable()
  let etag = headers.get('If-None-Match')?.replace(/^W\//, '').replaceAll('"', '')
  let bucket = contentBucket()
  let key = videoKey(id)
  let object: R2Object | R2ObjectBody | null
  try {
    object = await bucket.get(key, { range, onlyIf: etag ? { etagDoesNotMatch: etag } : undefined })
  } catch {
    // A range R2 can't satisfy (past the end).
    let head = await bucket.head(key)
    return head ? unsatisfiable(head.size) : new Response('Not found', { status: 404 })
  }
  if (!object) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  let out = new Headers()
  out.set('Content-Type', 'video/mp4')
  out.set('Cache-Control', IMMUTABLE)
  out.set('ETag', object.httpEtag)
  out.set('Accept-Ranges', 'bytes')
  out.set('Cross-Origin-Resource-Policy', 'same-origin')

  // If-None-Match held: R2 returns the metadata only.
  if (!('body' in object)) return new Response(null, { status: 304, headers: out })

  let body = object.body as unknown as ReadableStream
  if (range) {
    let size = object.size
    let start = 'suffix' in range ? Math.max(0, size - range.suffix) : (range.offset ?? 0)
    if (start >= size) return unsatisfiable(size)
    let length = 'suffix' in range ? size - start : Math.min(range.length ?? size - start, size - start)
    out.set('Content-Range', `bytes ${start}-${start + length - 1}/${size}`)
    out.set('Content-Length', String(length))
    return new Response(body, { status: 206, headers: out })
  }
  out.set('Content-Length', String(object.size))
  return new Response(body, { status: 200, headers: out })
}
