// Where a lesson video lives (decision 029). Nothing here may import
// `#platform`: the test platform and the content CLI use it while
// `#platform` is still loading.
import { routes } from '../routes.ts'

/** The id is random and never reused, so the object never changes. */
export function videoKey(id: string): string {
  return `videos/${id}.mp4`
}

/** Public URL of a ready video (app/video/serve.ts answers it). */
export function videoHref(id: string): string {
  return routes.media.video.href({ id })
}
