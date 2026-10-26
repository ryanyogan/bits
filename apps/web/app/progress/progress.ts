// Where progress lives (decision 016).
//
// Signed in: D1 (lesson_progress, xp_events, exercise_attempts, activity_days,
// user_badges), written in one batch per completed lesson.
// Signed out: the session (itself a D1 row, see app/auth/session.ts), under
// PROGRESS_KEY. At sign-in completeAuth keeps the session data, and
// startUserSession replays it through the same checks into the account.
import {
  awardBadges,
  findUserById,
  listCompletedLessons,
  listPassedExercises,
  recordLessonCompletion,
  type D1DataTableDatabase,
  type User,
} from '@bits/db'
import type { RequestContext } from 'remix/router'
import { Session } from 'remix/session'

import { currentUser } from '../auth/identity.ts'
import type { Catalog } from '../content/catalog.ts'
import { contentBucket, getCatalog } from '../content/request.ts'
import { loadCatalog } from '../content/store.ts'
import type { Completed } from '../content/types.ts'
import { getDatabase } from '../middleware/database.ts'
import { badgeDefinitions, earnedBadgeIds, type BadgeDefinition } from './badges.ts'
import { checkLesson, type CheckedLesson, type LessonSubmission } from './check.ts'
import { addDays, localDay } from './days.ts'

/** Session key for a signed-out visitor's completed lessons. */
export const PROGRESS_KEY = 'progress'

/** Lessons kept for a signed-out visitor; the oldest drop off first. */
const MAX_ANONYMOUS_LESSONS = 60

/** A lesson a signed-out visitor completed, with what they submitted. */
interface AnonymousLesson {
  at: number
  submission: LessonSubmission
}

type AnonymousProgress = Record<string, AnonymousLesson>

type ProgressContext = RequestContext<any, any>

function readAnonymous(session: Session | undefined): AnonymousProgress {
  let value = session?.get(PROGRESS_KEY)
  if (!value || typeof value !== 'object') return {}
  let progress: AnonymousProgress = {}
  for (let [key, lesson] of Object.entries(value as Record<string, Partial<AnonymousLesson>>)) {
    if (typeof lesson?.at !== 'number' || !lesson.submission || typeof lesson.submission !== 'object') continue
    let { prompts = {}, ran = {}, quizzes = {} } = lesson.submission
    progress[key] = { at: lesson.at, submission: { prompts, ran, quizzes } }
  }
  return progress
}

/** The viewer's completed lessons: from D1 when signed in, else the session. */
export async function loadCompleted(context: ProgressContext): Promise<Completed> {
  let user = currentUser(context)
  if (user) {
    let rows = await listCompletedLessons(getDatabase(context), user.id)
    return new Map(rows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  }
  let anonymous = readAnonymous(context.get(Session))
  return new Map(Object.entries(anonymous).map(([key, lesson]) => [key, lesson.at]))
}

export type CompletionResult =
  | { ok: true; checked: CheckedLesson; badges: BadgeDefinition[] }
  | { ok: false; checked: CheckedLesson }

/**
 * Completes course/lesson for the viewer after re-running its checks.
 * Returns the newly earned badges (signed in only).
 */
export async function completeLesson(
  context: ProgressContext,
  courseSlug: string,
  lessonSlug: string,
  submission: LessonSubmission,
): Promise<CompletionResult | undefined> {
  let catalog = await getCatalog(context)
  let content = await catalog.lessonContent(courseSlug, lessonSlug)
  if (!content) return undefined
  let checked = checkLesson(courseSlug, lessonSlug, content, submission)
  if (!checked.ok) return { ok: false, checked }

  let user = currentUser(context)
  if (user) {
    let badges = await recordForUser(getDatabase(context), catalog, user, courseSlug, lessonSlug, checked, Date.now())
    return { ok: true, checked, badges }
  }

  let session = context.get(Session)
  if (session) {
    let anonymous = readAnonymous(session)
    anonymous[`${courseSlug}/${lessonSlug}`] = { at: Date.now(), submission }
    let kept = Object.entries(anonymous)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_ANONYMOUS_LESSONS)
    session.set(PROGRESS_KEY, Object.fromEntries(kept))
  }
  return { ok: true, checked, badges: [] }
}

async function recordForUser(
  db: D1DataTableDatabase,
  catalog: Catalog,
  user: User,
  courseSlug: string,
  lessonSlug: string,
  checked: CheckedLesson,
  at: number,
): Promise<BadgeDefinition[]> {
  await record(db, user, courseSlug, lessonSlug, checked, at)
  return awardNewBadges(db, catalog, user.id, Date.now())
}

/** One batch: progress, journal, once-only awards, activity, streak. */
function record(db: D1DataTableDatabase, user: User, courseSlug: string, lessonSlug: string, checked: CheckedLesson, at: number) {
  let day = localDay(at, user.timezone)
  return recordLessonCompletion(db, {
    userId: user.id,
    courseId: courseSlug,
    lessonSlug,
    attempts: checked.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      prompt: exercise.prompt,
      passed: exercise.passed,
      temperatures: exercise.temperatures.map((t) => t / 100),
    })),
    awards: checked.awards.map((award) => ({ id: crypto.randomUUID(), ...award })),
    day,
    yesterday: addDays(day, -1),
    now: at,
  })
}

/** Awards every badge whose rule now holds; returns the ones that are new. */
async function awardNewBadges(db: D1DataTableDatabase, catalog: Catalog, userId: string, now: number): Promise<BadgeDefinition[]> {
  let [completedRows, passed, user, held] = await Promise.all([
    listCompletedLessons(db, userId),
    listPassedExercises(db, userId),
    findUserById(db, userId),
    db.d1.prepare('select badge_id from user_badges where user_id = ?').bind(userId).all<{ badge_id: string }>(),
  ])
  let completed: Completed = new Map(completedRows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  let earned = earnedBadgeIds({ completed, exercisesPassed: passed.length, bestStreak: user?.best_streak ?? 0 }, catalog)
  let already = new Set(held.results.map((row) => row.badge_id))
  let fresh = earned.filter((id) => !already.has(id))
  await awardBadges(db, userId, fresh, now)
  return badgeDefinitions(catalog).filter((badge) => fresh.includes(badge.id))
}

/**
 * Moves a signed-out visitor's progress into the account they just signed
 * in to. Each lesson is re-checked against today's content and recorded on
 * the day it was done; awards are once-only, so a replay is harmless.
 */
export async function mergeAnonymousProgress(db: D1DataTableDatabase, session: Session, user: User): Promise<void> {
  let anonymous = readAnonymous(session)
  let lessons = Object.entries(anonymous).sort((a, b) => a[1].at - b[1].at)
  if (lessons.length === 0) return
  let catalog = await loadCatalog(db, contentBucket())
  for (let [key, lesson] of lessons) {
    let [courseSlug, lessonSlug] = key.split('/') as [string, string]
    let content = await catalog.lessonContent(courseSlug, lessonSlug)
    if (!content) continue
    let checked = checkLesson(courseSlug, lessonSlug, content, lesson.submission)
    if (!checked.ok) continue
    await record(db, user, courseSlug, lessonSlug, checked, lesson.at)
  }
  await awardNewBadges(db, catalog, user.id, Date.now())
  session.unset(PROGRESS_KEY)
}
