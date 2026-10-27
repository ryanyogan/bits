// Certificates (decision 028): a page per finished course, derived from
// lesson_progress, never stored. It exists while the user has completed
// every lesson of the live course, and is visible when their profile is
// public (or to themselves). It carries only what the public profile shows.
import { findUserByHandle, listCompletedLessons, type D1DataTableDatabase, type User } from '@bits/db'

import type { Catalog } from '../../content/catalog.ts'
import type { CourseDetail } from '../../content/types.ts'
import { badgeDefinitions } from '../../progress/badges.ts'

export interface Certificate {
  name: string
  handle: string
  course: CourseDetail
  /** When the last lesson was completed, epoch ms. */
  finishedAt: number
  /** The finished course's badge. */
  badge: { name: string; glyph: string; color: string }
  /** The profile is private: only its owner is looking (nothing to share). */
  isPrivate: boolean
}

/**
 * The certificate for `handle` and `courseSlug`, or undefined (404) when
 * there's no such user or course, the course isn't finished, or the profile
 * is private and `viewer` isn't its owner. One message for all of them, so
 * handles and progress can't be probed.
 */
export async function getCertificate(
  db: D1DataTableDatabase,
  catalog: Catalog,
  handle: string,
  courseSlug: string,
  viewer: Pick<User, 'id'> | null,
): Promise<Certificate | undefined> {
  let user = await findUserByHandle(db, handle)
  if (!user || (!user.is_public && viewer?.id !== user.id)) return undefined
  let rows = await listCompletedLessons(db, user.id)
  let completed = new Map(rows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  let course = catalog.getCourse(courseSlug, completed)
  if (!course) return undefined
  let lessons = course.modules.flatMap((m) => m.lessons)
  let times = lessons.map((lesson) => completed.get(`${course.slug}/${lesson.slug}`))
  if (lessons.length === 0 || times.some((at) => at === undefined)) return undefined
  let badge = badgeDefinitions(catalog).find((b) => b.id === `course:${course.slug}`)
  return {
    name: user.display_name || user.handle,
    handle: user.handle,
    course,
    finishedAt: Math.max(...(times as number[])),
    badge: { name: course.badge.name, glyph: course.badge.glyph, color: badge?.color ?? 'var(--volt)' },
    isPrivate: !user.is_public,
  }
}
