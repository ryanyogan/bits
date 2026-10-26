// Badges are defined in code: an id, a rule and a glyph. The server awards a
// badge (user_badges) the first time its rule is true after a completion.
import { courses, getCourse, type Completed } from '../data/fixtures.ts'

export interface BadgeStats {
  completed: Completed
  /** Exercises the user has earned neurons for. */
  exercisesPassed: number
  bestStreak: number
}

export interface BadgeDefinition {
  id: string
  name: string
  glyph: string
  /** Fill token once earned. */
  color: string
  rule(stats: BadgeStats): boolean
}

const courseBadges: BadgeDefinition[] = courses.map((info, i) => {
  let course = getCourse(info.slug)!
  let lessons = course.modules.flatMap((m) => m.lessons)
  return {
    id: `course:${course.slug}`,
    name: course.badge.name,
    glyph: course.badge.glyph,
    color: ['var(--volt)', 'var(--ion)', 'var(--synapse)'][i % 3]!,
    rule: ({ completed }) => lessons.every((l) => completed.has(`${course.slug}/${l.slug}`)),
  }
})

export const badgeDefinitions: BadgeDefinition[] = [
  { id: 'first-token', name: 'First token', glyph: '1st', color: 'var(--volt)', rule: (s) => s.completed.size >= 1 },
  { id: 'few-shot', name: 'Few-shot', glyph: '×3', color: 'var(--synapse)', rule: (s) => s.exercisesPassed >= 3 },
  { id: 'streak-7', name: 'Streak ×7', glyph: '7d', color: 'var(--volt-soft)', rule: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', name: 'Streak ×30', glyph: '30d', color: 'var(--volt-soft)', rule: (s) => s.bestStreak >= 30 },
  ...courseBadges,
]

/** Ids of every badge whose rule holds for these stats. */
export function earnedBadgeIds(stats: BadgeStats): string[] {
  return badgeDefinitions.filter((badge) => badge.rule(stats)).map((badge) => badge.id)
}
