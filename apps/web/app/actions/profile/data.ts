// Profile data for /me and /u/:handle (docs/design/spec/pages/Profile.md),
// read from D1: progress, the XP ledger, badges, the prompt journal and
// activity days (decision 016).
import {
  countAttempts,
  findUserByHandle,
  listActivityDays,
  listAttempts,
  listCompletedLessons,
  listIdentities,
  listUserBadges,
  type D1DataTableDatabase,
  type ExerciseAttempt,
  type User,
} from '@bits/db'
import type { ActivityLevel } from '@bits/ui/activity-grid'

import { listCourses, getLesson, type Completed, type CourseSummary } from '../../data/fixtures.ts'
import { badgeDefinitions } from '../../progress/badges.ts'
import { addDays, currentStreak, localDay } from '../../progress/days.ts'
import { levelFor } from '../../progress/levels.ts'
import { exercisesOf } from '../courses/lesson/content.ts'
import { getLessonContent } from '../courses/lesson/fixtures.ts'
import { promptChecks, temperatureLabel } from '../courses/lesson/ui/exercise.ts'

export interface Badge {
  name: string
  glyph: string
  earned: boolean
  /** Fill token for earned badges. */
  color?: string
}

export interface JournalEntry {
  prompt: string
  lesson: string
  result: string
  /** `passed` results are volt, `runs` results ion (components §11.4). */
  tone: 'passed' | 'runs'
}

export interface Profile {
  name: string
  handle: string
  email: string
  isPublic: boolean
  level: number
  levelName: string
  /** Progress to the next level, 0–100. */
  levelPct: number
  toNextLevel: number
  since: string
  goal?: string
  neurons: number
  streak: number
  bestStreak: number
  lessonsFinished: number
  promptsWritten: number
  signIn: string
  courses: CourseSummary[]
  badges: Badge[]
  journal: JournalEntry[]
  activity: ActivityLevel[]
  /** The heatmap's last day (the user's today), YYYY-MM-DD. */
  activityEnd: string
}

const activityText = { 0: 'no activity', 1: '1 activity', 2: '2–3 activities', 3: '4+ activities' } as const

/** Hover titles for the heatmap cells, ending on `end` (YYYY-MM-DD). */
export function activityTitles(levels: ActivityLevel[], end: string): string[] {
  let today = new Date(`${end}T00:00:00Z`)
  let format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return levels.map((level, i) => {
    let day = new Date(today.getTime() - (levels.length - 1 - i) * 86_400_000)
    return `${format.format(day)} · ${activityText[level]}`
  })
}

const DAYS = 182

/** Heatmap levels for the last 182 local days ending `today`. */
function activityLevels(rows: { day: string; actions: number }[], today: string): ActivityLevel[] {
  let byDay = new Map(rows.map((row) => [row.day, row.actions]))
  return Array.from({ length: DAYS }, (_, i) => {
    let actions = byDay.get(addDays(today, i - (DAYS - 1))) ?? 0
    return (actions === 0 ? 0 : actions === 1 ? 1 : actions <= 3 ? 2 : 3) as ActivityLevel
  })
}

const goalPhrases: Record<string, string> = {
  curious: 'understand how AI works',
  work: 'use AI at work',
  code: 'build with code',
  teach: 'teach others',
}

const methodLabels = { github: 'GitHub', google: 'Google' } as const

/** A user's profile, read from D1 (lesson_progress, xp, badges, journal, activity). */
async function profileFor(db: D1DataTableDatabase, user: User, now = Date.now()): Promise<Profile> {
  let today = localDay(now, user.timezone)
  let [completedRows, attempts, promptsWritten, held, activity, identities] = await Promise.all([
    listCompletedLessons(db, user.id),
    listAttempts(db, user.id, 50),
    countAttempts(db, user.id),
    listUserBadges(db, user.id),
    listActivityDays(db, user.id, addDays(today, -(DAYS - 1))),
    listIdentities(db, user.id),
  ])
  let completed: Completed = new Map(completedRows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  let level = levelFor(user.xp_total)
  let earned = new Set(held.map((row) => row.badge_id))
  let started = listCourses(completed).filter((course) => course.pct > 0)
  let name = user.display_name || user.handle

  return {
    name,
    handle: user.handle,
    email: user.email,
    isPublic: user.is_public,
    level: level.level,
    levelName: level.name,
    levelPct: level.pct,
    toNextLevel: level.toNext,
    since: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(user.created_at),
    goal: goalPhrases[user.goals[0] ?? ''],
    neurons: user.xp_total,
    streak: currentStreak(user, now),
    bestStreak: user.best_streak,
    lessonsFinished: completed.size,
    promptsWritten,
    signIn: ['Email', ...identities.map((identity) => methodLabels[identity.provider])].join(' · '),
    // Courses under way first, then finished ones.
    courses: [...started.filter((c) => c.pct < 100), ...started.filter((c) => c.pct >= 100)],
    badges: badgeDefinitions
      .map((badge) => ({ name: badge.name, glyph: badge.glyph, earned: earned.has(badge.id), color: badge.color }))
      .sort((a, b) => Number(b.earned) - Number(a.earned)),
    journal: attempts.map((attempt) => journalEntry(attempt)),
    activity: activityLevels(activity, today),
    activityEnd: today,
  }
}

function journalEntry(attempt: ExerciseAttempt): JournalEntry {
  let found = getLesson(attempt.course_id, attempt.lesson_slug)
  let where = found ? `${found.course.title} · L${found.lesson.n}` : attempt.course_id
  let block = found
    ? exercisesOf(getLessonContent(found.course.slug, found.lesson)).find((e) => e.id === attempt.exercise_id)
    : undefined
  let checks = block ? promptChecks(block).length : 0
  if (attempt.temperatures.length && !attempt.passed) {
    let temps = attempt.temperatures.map((t) => `T=${temperatureLabel(t)}`).join(' and ')
    return { prompt: attempt.prompt, lesson: where, result: `ran at ${temps}`, tone: 'runs' }
  }
  return {
    prompt: attempt.prompt,
    lesson: where,
    result: attempt.passed ? `✓ passed ${checks}/${checks} checks` : 'not passed yet',
    tone: attempt.passed ? 'passed' : 'runs',
  }
}

/** The signed-in user's own profile (`/me`). */
export function getOwnProfile(db: D1DataTableDatabase, user: User): Promise<Profile> {
  return profileFor(db, user)
}

/** A public profile by handle; private or unknown handles return undefined (404). */
export async function getPublicProfile(db: D1DataTableDatabase, handle: string): Promise<Profile | undefined> {
  let user = await findUserByHandle(db, handle)
  return user?.is_public ? profileFor(db, user) : undefined
}

/** Journal entries the profile shows before "All →". */
export const RECENT_JOURNAL = 3
