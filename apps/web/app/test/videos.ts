// Test support: a ready lesson video, seeded by the test platform before it
// builds content/courses/, so the Temperature lesson links it and opens with
// the player (decisions 029, 055). The "MP4" is 64 KiB of patterned bytes: enough to test
// Range answers, not playable.
import { insertVideo, markVideoReady, type D1DataTableDatabase } from '@bits/db'
import type { R2Bucket } from '@cloudflare/workers-types/index.ts'

import { videoKey } from '../video/keys.ts'

export const testVideo = {
  id: '00000000-0000-4000-8000-000000000006',
  course: 'tokens-and-temperature',
  path: 'assets/06-temperature.mp4',
  duration: 270,
  size: 64 * 1024,
}

export function testVideoBytes(): Uint8Array {
  return Uint8Array.from({ length: testVideo.size }, (_, i) => i % 251)
}

export async function seedTestVideo(db: D1DataTableDatabase, bucket: R2Bucket): Promise<void> {
  await bucket.put(videoKey(testVideo.id), testVideoBytes(), { httpMetadata: { contentType: 'video/mp4' } })
  await insertVideo(db, {
    id: testVideo.id,
    course_id: testVideo.course,
    path: testVideo.path,
    r2_key: videoKey(testVideo.id),
    upload_id: 'test',
    size: testVideo.size,
    part_size: testVideo.size,
    uploaded_by: null,
    created_at: Date.now(),
  })
  await markVideoReady(db, testVideo.id, testVideo.duration, Date.now())
}
