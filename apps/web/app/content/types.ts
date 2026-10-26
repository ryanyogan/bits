// Course shapes. A course is authored as a markdown folder
// (content/courses/<slug>/), compiled by app/content/compile/ into a
// CourseManifest plus one LessonContent per lesson (lesson/content.ts), and
// stored in R2 (app/content/store.ts). Viewer progress is never part of the
// content: pass the viewer's completed lessons (app/progress/progress.ts
// loadCompleted) to the Catalog to get states and pct.
import type { CourseCardProps, CourseFormat } from '@bits/ui/course-card'
import type { CoverPattern } from '@bits/ui/course-cover'
import type { LessonState } from '@bits/ui/lesson-node'

export type Tone = NonNullable<CourseCardProps['tone']>

export const tracks = ['Foundations', 'Prompting', 'Tools', 'Agents'] as const
export type Track = (typeof tracks)[number]

export const levels = ['Beginner', 'Intermediate', 'Advanced'] as const
export type Level = (typeof levels)[number]

export const lessonKinds = ['chat', 'type', 'video', 'code', 'project'] as const
export type LessonKind = (typeof lessonKinds)[number]

/** A course card as authored: no viewer progress (see CourseSummary). */
export interface CourseInfo {
  slug: string
  title: string
  desc: string
  track: Track
  level: Level
  lessons: number
  mins: number
  sigil: string
  tone: Tone
  pattern: CoverPattern
  formats: CourseFormat[]
}

/** A course with the viewer's progress, 0–100. */
export interface CourseSummary extends CourseInfo {
  pct: number
}

export interface LessonInfo {
  n: number
  slug: string
  title: string
  mins: number
  xp: number
  kinds: LessonKind[]
}

/** A lesson with the viewer's state: done, current (where to resume) or next. */
export interface LessonSummary extends LessonInfo {
  state: LessonState
}

export interface ModuleInfo {
  n: string
  title: string
  lessons: LessonInfo[]
}

export interface CourseModule {
  n: string
  title: string
  lessons: LessonSummary[]
}

export interface CourseBadge {
  id: string
  name: string
  glyph: string
}

/** Course page copy beyond the card. */
interface CourseExtras {
  outcomes: string[]
  badge: CourseBadge
  /** The course.md body: the hero lead. */
  lead?: string
  authors: string[]
  /** Secondary hero CTA label when lesson 1 has a video. */
  introLabel?: string
  /** "You stopped at the exercise: …" under the current lesson. */
  exercise?: string
  /** ISO date (YYYY-MM-DD) the live version was published. */
  updated?: string
  /** Lesson videos named in frontmatter, for the author page. */
  videos?: CourseVideo[]
}

/**
 * A compiled course (`manifest.json` in R2): the card, the course page copy
 * and the syllabus. Lesson bodies are separate objects, loaded on demand.
 */
export interface CourseManifest extends CourseInfo, CourseExtras {
  modules: ModuleInfo[]
}

export interface CourseVideo {
  /** Lesson number and title. */
  n: number
  lesson: string
  /** Asset path in the course folder. */
  file: string
  /** The file was in the folder. */
  found: boolean
  /** Seconds (frontmatter `duration`). */
  duration: number
}

export interface CourseDetail extends CourseSummary, CourseExtras {
  modules: CourseModule[]
}

/**
 * Lessons the viewer has completed, keyed `course/lesson` (value: completed
 * at, epoch ms). Loaded per request by app/progress/progress.ts.
 */
export type Completed = ReadonlyMap<string, number>

export const NO_PROGRESS: Completed = new Map()
