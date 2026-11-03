// Certificates (decision 028): a page per finished course, derived from
// lesson_progress, never stored. It exists while the user has completed
// every lesson of the live course, and is visible when their profile is
// public (or to themselves). It carries only what the public profile shows.
import { readUserWithCompleted, type D1DataTableDatabase, type PassedBuild, type User } from '@bits/db'

import { verifiesOf } from '../courses/lesson/content.ts'

import type { Catalog } from '../../content/catalog.ts'
import { isComingSoon, type CourseDetail } from '../../content/types.ts'
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
  /**
   * The course's final deploy check passed (decision 072): the origin it
   * passed on. Public profiles only. It proves a Worker answered, not who wrote it.
   */
  proof?: { origin: string; checkedAt: number }
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
  // The user, their progress and (public profiles) the course's passing deploy checks in one batch (decisions 035, 072).
  let found = await readUserWithCompleted(db, handle, { passedBuildsFor: courseSlug })
  if (!found) return undefined
  let { user, completed: rows, passedBuilds } = found
  if (!user.is_public && viewer?.id !== user.id) return undefined
  let completed = new Map(rows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  let course = catalog.getCourse(courseSlug, completed)
  // A coming-soon course (decision 073) has no lessons to finish.
  if (!course || isComingSoon(course)) return undefined
  let lessons = course.modules.flatMap((m) => m.lessons)
  let times = lessons.map((lesson) => completed.get(`${course.slug}/${lesson.slug}`))
  if (lessons.length === 0 || times.some((at) => at === undefined)) return undefined
  let badge = badgeDefinitions(catalog).find((b) => b.id === `course:${course.slug}`)
  let proof = user.is_public ? await finalDeploy(catalog, passedBuilds, course.slug, lessons.map((lesson) => lesson.slug)) : undefined
  return {
    name: user.display_name || user.handle,
    handle: user.handle,
    course,
    finishedAt: Math.max(...(times as number[])),
    badge: { name: course.badge.name, glyph: course.badge.glyph, color: badge?.color ?? 'var(--volt)' },
    isPrivate: !user.is_public,
    ...(proof ? { proof } : {}),
  }
}

/**
 * Where the course's final `:::verify` block (the last one in course order)
 * passed for this user, if it did. Reads lesson content only when the user
 * has a passing check in the course at all, so most certificates cost no R2 read.
 */
async function finalDeploy(catalog: Catalog, passed: PassedBuild[], courseSlug: string, lessonSlugs: string[]): Promise<Certificate['proof']> {
  if (!passed.length) return undefined
  for (let slug of [...lessonSlugs].reverse()) {
    let content = await catalog.lessonContent(courseSlug, slug)
    let last = content ? verifiesOf(content).at(-1) : undefined
    if (!last) continue
    let row = passed.find((p) => p.lesson_slug === slug && p.verify_id === last.id)
    return row ? { origin: row.origin, checkedAt: row.created_at } : undefined
  }
  return undefined
}
