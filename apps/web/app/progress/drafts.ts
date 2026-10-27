// Lesson drafts on the server (decision 029): a signed-in learner's exercise
// drafts, retyped code and watch position, so another device (or a cleared
// browser) resumes. The browser side is @bits/ui's lib/drafts.ts: it writes
// localStorage first and sends the newer copy here, debounced.
import { loadLessonDrafts, saveLessonDrafts, type SavedDraft } from '@bits/db'
import type { RequestContext } from 'remix/router'

import { currentUser } from '../auth/identity.ts'
import { getDatabase } from '../middleware/database.ts'

export type { SavedDraft }
export { draftKey, lessonDraftKeys } from './draft-keys.ts'

/** Longest draft kept (the prompt cap; retyped code files are shorter). */
export const MAX_DRAFT_LENGTH = 4000
/** Drafts per save request (the browser batches up to this many). */
export const MAX_DRAFTS_PER_SAVE = 8

/** The signed-in viewer's drafts in a lesson; undefined when signed out. */
export async function loadDrafts(
  context: RequestContext<any, any>,
  courseId: string,
  lessonSlug: string,
): Promise<Record<string, SavedDraft> | undefined> {
  let user = currentUser(context)
  if (!user) return undefined
  return loadLessonDrafts(getDatabase(context), user.id, courseId, lessonSlug)
}

export async function saveDrafts(
  context: RequestContext<any, any>,
  userId: string,
  courseId: string,
  lessonSlug: string,
  drafts: { key: string; value: string }[],
): Promise<void> {
  await saveLessonDrafts(getDatabase(context), userId, courseId, lessonSlug, drafts, Date.now())
}
