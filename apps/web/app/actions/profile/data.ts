// Profile data for /me and /u/:handle (docs/design/spec/pages/Profile.md),
// read from D1: progress, the XP ledger, badges, the prompt journal and
// activity days (decision 016). All of it is one batch (decision 035); on
// /me that batch is the session read itself.
import {
  readProfileRows,
  readPublicProfile,
  type D1DataTableDatabase,
  type ExerciseAttempt,
  type ProfileOptions,
  type ProfileRows,
  type User,
} from '@bits/db'
import type { ActivityLevel } from '@bits/ui/activity-grid'

import type { Catalog } from '../../content/catalog.ts'
import type { Completed, CourseSummary } from '../../content/types.ts'
import { badgeDefinitions } from '../../progress/badges.ts'
import { addDays, currentStreak, localDay } from '../../progress/days.ts'
import { levelFor } from '../../progress/levels.ts'
import { exercisesOf } from '../courses/lesson/content.ts'
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

/**
 * What to read for a profile at `now`. The heatmap ends on the user's local
 * today, which is within a day of UTC's, so the read starts one day early
 * and works for any timezone before the user row is known; the extra day is
 * never drawn.
 */
export function profileReadOptions(now = Date.now()): ProfileOptions {
  return { activitySince: addDays(localDay(now, 'UTC'), -DAYS) }
}

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

/** A user's profile from their rows (lesson_progress, xp, badges, journal, activity). */
async function profileFor(catalog: Catalog, user: User, rows: ProfileRows, now: number): Promise<Profile> {
  let today = localDay(now, user.timezone)
  let { completed: completedRows, attempts, promptsWritten, badges: held, activity, identities } = rows
  let completed: Completed = new Map(completedRows.map((row) => [`${row.course_id}/${row.lesson_slug}`, row.completed_at]))
  let level = levelFor(user.xp_total)
  let earned = new Set(held.map((row) => row.badge_id))
  let started = catalog.listCourses(completed).filter((course) => course.pct > 0)
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
    badges: badgeDefinitions(catalog)
      .map((badge) => ({ name: badge.name, glyph: badge.glyph, earned: earned.has(badge.id), color: badge.color }))
      .sort((a, b) => Number(b.earned) - Number(a.earned)),
    journal: await Promise.all(attempts.map((attempt) => journalEntry(catalog, attempt))),
    activity: activityLevels(activity, today),
    activityEnd: today,
  }
}

async function journalEntry(catalog: Catalog, attempt: ExerciseAttempt): Promise<JournalEntry> {
  let found = catalog.getLesson(attempt.course_id, attempt.lesson_slug)
  let where = found ? `${found.course.title} · L${found.lesson.n}` : attempt.course_id
  let content = found ? await catalog.lessonContent(attempt.course_id, attempt.lesson_slug) : undefined
  let block = content ? exercisesOf(content).find((e) => e.id === attempt.exercise_id) : undefined
  let checks = block ? promptChecks(block).length : 0
  if (attempt.source !== 'submit') {
    // A run (decision 019): live, or the lesson's example output.
    let at = `ran at T=${temperatureLabel((attempt.temperature ?? 0) / 100)}`
    return { prompt: attempt.prompt, lesson: where, result: attempt.source === 'live' ? at : `${at} · example`, tone: 'runs' }
  }
  return {
    prompt: attempt.prompt,
    lesson: where,
    result: attempt.passed ? `✓ passed ${checks}/${checks} checks` : 'not passed yet',
    tone: attempt.passed ? 'passed' : 'runs',
  }
}

/**
 * The signed-in user's own profile (`/me`). Pass the rows read with the
 * session (`profileLoadedWith`); without them they are read here, in one batch.
 */
export async function getOwnProfile(
  db: D1DataTableDatabase,
  catalog: Catalog,
  user: User,
  rows?: ProfileRows,
  now = Date.now(),
): Promise<Profile> {
  return profileFor(catalog, user, rows ?? (await readProfileRows(db, user.id, profileReadOptions(now))), now)
}

/** A public profile by handle, in one batch; private or unknown handles return undefined (404). */
export async function getPublicProfile(db: D1DataTableDatabase, catalog: Catalog, handle: string, now = Date.now()): Promise<Profile | undefined> {
  let found = await readPublicProfile(db, handle, profileReadOptions(now))
  return found ? profileFor(catalog, found.user, found.rows, now) : undefined
}

/** Journal entries the profile shows before "All →". */
export const RECENT_JOURNAL = 3
