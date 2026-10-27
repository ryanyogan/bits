// What a content build links lessons to (decision 029): the newest ready
// upload for each course + `video:` path. Loaded once before a build, so
// the build itself stays pure.
import { listReadyVideos, type D1DataTableDatabase } from '@bits/db'

import type { LinkedVideo } from '../content/compile/index.ts'
import { videoHref } from './keys.ts'

export type VideoLinks = (course: string, path: string) => LinkedVideo | undefined

export async function loadVideoLinks(db: D1DataTableDatabase): Promise<VideoLinks> {
  let ready = await listReadyVideos(db)
  return (course, path) => {
    let video = ready.get(`${course}/${path}`)
    if (!video) return undefined
    return video.durationS ? { src: videoHref(video.id), duration: video.durationS } : { src: videoHref(video.id) }
  }
}
