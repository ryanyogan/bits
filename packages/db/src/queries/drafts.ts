// Lesson drafts (migration 0006, decision 029): what a signed-in learner
// typed into a lesson's exercises, what they retyped in type mode, and their
// watch position. The browser keeps its own copy in localStorage and sends
// the newer one here in the background.
import type { D1DataTableDatabase } from '../d1/database.ts'

export interface SavedDraft {
  value: string
  /** Epoch ms. */
  at: number
}

/** Every draft the user keeps in one lesson, by key. */
export async function loadLessonDrafts(
  db: D1DataTableDatabase,
  userId: string,
  courseId: string,
  lessonSlug: string,
): Promise<Record<string, SavedDraft>> {
  let { results } = await db.d1
    .prepare('select key, value, updated_at from lesson_drafts where user_id = ?1 and course_id = ?2 and lesson_slug = ?3')
    .bind(userId, courseId, lessonSlug)
    .all<{ key: string; value: string; updated_at: number }>()
  let drafts: Record<string, SavedDraft> = {}
  for (let row of results) drafts[row.key] = { value: row.value, at: row.updated_at }
  return drafts
}

/** Upserts several drafts of one lesson in one batch. */
export async function saveLessonDrafts(
  db: D1DataTableDatabase,
  userId: string,
  courseId: string,
  lessonSlug: string,
  drafts: { key: string; value: string }[],
  now: number,
): Promise<void> {
  if (!drafts.length) return
  let statement = db.d1.prepare(
    `insert into lesson_drafts (user_id, course_id, lesson_slug, key, value, updated_at)
     values (?1, ?2, ?3, ?4, ?5, ?6)
     on conflict (user_id, course_id, lesson_slug, key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  )
  await db.d1.batch(drafts.map((draft) => statement.bind(userId, courseId, lessonSlug, draft.key, draft.value, now)))
}
