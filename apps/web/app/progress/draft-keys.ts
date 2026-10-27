// Server-side names of a lesson's drafts (decision 029). Pure: the content
// build reaches this through lesson/ui/exercise.ts, and the test platform
// runs the build while `#platform` is still loading.
import { hasVideo, type LessonContent } from '../actions/courses/lesson/content.ts'

export const draftKey = {
  prompt: (exerciseId: string) => `prompt:${exerciseId}`,
  code: (file: string) => `code:${file}`,
  video: 'video',
}

/**
 * The drafts a lesson can have. Saves for any other key are refused, so a
 * learner can't fill D1 with made-up keys.
 */
export function lessonDraftKeys(content: LessonContent): Set<string> {
  let keys = new Set<string>()
  for (let block of content.blocks) {
    if (block.type === 'prompt') keys.add(draftKey.prompt(block.id))
    if (block.type === 'code' && block.files[0]?.typeMode) keys.add(draftKey.code(block.files[0].file))
  }
  if (hasVideo(content)) keys.add(draftKey.video)
  return keys
}
