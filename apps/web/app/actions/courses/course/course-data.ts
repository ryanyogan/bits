// View model for /courses/:course. Turns the compiled course (with the
// viewer's progress applied) into exactly what the page draws, so the
// components stay dumb and the rules live in one testable place.
import type { LessonState } from '@bits/ui/lesson-node'

import type { Viewer } from '../../../auth/identity.ts'
import { isComingSoon, type CourseDetail, type CourseSummary, type LessonKind, type LessonSummary } from '../../../content/types.ts'

const DEFAULT_AUTHOR = 'The bits team'
const DEFAULT_UPDATED = '2026-09-28'

/** Where course sources live (decision 036: master publishes `content/courses/`). */
export const COURSE_SOURCE_TREE = 'https://github.com/ryanyogan/bits/tree/master/content/courses'

/**
 * What a lesson holds, in plain words (decision 066: no glyph key to learn).
 * Rows leave `chat` out when every lesson of the course is a chat.
 */
export const kindLabels: Record<LessonKind, { label: string; color: string }> = {
  chat: { label: 'Chat', color: 'var(--muted)' },
  type: { label: 'Prompt exercise', color: 'var(--volt)' },
  video: { label: 'Video', color: 'var(--ion)' },
  code: { label: 'Code exercise', color: 'var(--synapse)' },
  project: { label: 'Project', color: 'var(--synapse)' },
}

export type CourseState = 'new' | 'started' | 'finished'

export interface SyllabusLesson extends LessonSummary {
  /** Absent in a coming-soon course (decision 073): the row is the plan, not a link. */
  href?: string
  /** The kinds the row names (`chat` dropped when every lesson is a chat). */
  tags: LessonKind[]
  /**
   * Trace segment from this node down to the next one in the module; `tail`
   * runs from the last (current) node down beside its resume callout.
   */
  trace: 'done' | 'todo' | 'tail' | 'none'
  /** The current lesson names its exercise under the row, when it has one. */
  resume?: { exercise: string }
}

export interface SyllabusModuleView {
  n: string
  title: string
  lessons: SyllabusLesson[]
}

export interface CourseLink {
  label: string
  href: string
}

/** The course to offer once this one is finished. */
export interface NextCourse {
  title: string
  href: string
}

export interface CourseView {
  course: CourseDetail
  lead: string
  signedIn: boolean
  /** Listed before it opens (decision 073): no CTA, and the outline has no links. */
  soon: boolean
  state: CourseState
  pct: number
  done: number
  total: number
  /** Sum of the lesson minutes: the hero's total and "min left" use one formula. */
  totalMins: number
  minsLeft: number
  /** Primary CTA, with the lesson it opens underneath ("Lesson 3 · Title · 6 min"). None while the course is coming soon. */
  cta?: CourseLink & { sub?: string }
  /** Secondary CTA: the intro video before starting, the next course when finished. */
  secondary?: CourseLink & { icon?: 'play-inline' }
  /** Signed out: "sign in to keep your progress", returning here. */
  loginHref?: string
  modules: SyllabusModuleView[]
  learn: { n: number; label: string; color: string }[]
  neurons: number
  source: { files: number; path: string; href: string; author: string; updated: string; verified?: string }
}

export interface CourseViewOptions {
  lessonHref: (lesson: string) => string
  /** Sign-in that returns to this page. */
  loginHref: string
  /** The viewer's certificate for this course (signed in, every lesson done). */
  certificateHref?: string
  next?: NextCourse
  /** The current lesson's first exercise task, when it has one. */
  currentExercise?: string
}

/**
 * `course` carries the viewer's progress (D1 when signed in, the session
 * when not): lesson states and pct come from getCourse(slug, completed).
 */
export function buildCourseView(course: CourseDetail, viewer: Viewer | null, options: CourseViewOptions): CourseView {
  let { lessonHref } = options
  let signedIn = viewer !== null
  let soon = isComingSoon(course)
  let all = course.modules.flatMap((m) => m.lessons)
  let stateOf = (lesson: LessonSummary): LessonState => lesson.state

  let done = all.filter((l) => stateOf(l) === 'done').length
  let total = all.length
  let first = all[0]
  let open = all.find((l) => stateOf(l) === 'current') ?? all.find((l) => stateOf(l) !== 'done')
  let state: CourseState = done === 0 || soon ? 'new' : done === total ? 'finished' : 'started'
  let totalMins = all.reduce((sum, l) => sum + l.mins, 0)
  let minsLeft = all.filter((l) => stateOf(l) !== 'done').reduce((sum, l) => sum + l.mins, 0)
  let lessonLine = (l: LessonSummary) => `Lesson ${l.n} · ${l.title} · ${l.mins} min`

  let cta: CourseView['cta']
  let secondary: CourseView['secondary']
  if (soon || !first) {
    // Coming soon (decision 073): nothing to start yet.
  } else if (state === 'finished') {
    cta = options.certificateHref
      ? { label: 'View your certificate →', href: options.certificateHref }
      : { label: 'Sign in to claim your certificate →', href: options.loginHref }
    secondary = options.next
      ? { label: `Next course: ${options.next.title} →`, href: options.next.href }
      : { label: 'Review from lesson 1', href: lessonHref(first.slug) }
  } else if (state === 'started' && open) {
    // The label names the lesson number already: the line under it adds the title.
    cta = { label: `Continue lesson ${open.n} →`, href: lessonHref(open.slug), sub: `${open.title} · ${open.mins} min` }
  } else {
    cta = { label: 'Start the course →', href: lessonHref(first.slug), sub: lessonLine(first) }
    if (course.introLabel && first.kinds.includes('video')) {
      // The video plays at the top of the lesson (decision 055).
      secondary = { label: course.introLabel, href: lessonHref(first.slug), icon: 'play-inline' }
    }
  }

  let everyChat = all.every((l) => l.kinds.includes('chat'))
  let modules = course.modules.map((module) => ({
    n: module.n,
    title: module.title,
    lessons: module.lessons.map((lesson, index, list): SyllabusLesson => {
      let state = stateOf(lesson)
      let next = list[index + 1]
      let trace: SyllabusLesson['trace'] = next
        ? state === 'done' && stateOf(next) !== 'next'
          ? 'done'
          : 'todo'
        : state === 'current' && options.currentExercise
          ? 'tail'
          : 'none'
      return {
        ...lesson,
        state,
        href: soon ? undefined : lessonHref(lesson.slug),
        tags: lesson.kinds.filter((kind) => !(everyChat && kind === 'chat')),
        trace,
        resume: state === 'current' && options.currentExercise ? { exercise: options.currentExercise } : undefined,
      }
    }),
  }))

  // Code inside a checkpoint project counts as the project, not a separate exercise.
  let count = (kind: LessonKind) =>
    all.filter((l) => l.kinds.includes(kind) && !(kind === 'code' && l.kinds.includes('project'))).length
  let chat = count('chat')
  let learn = [
    { n: chat, label: chat === total ? 'lessons, every one a chat with Claude' : 'chat lessons', color: 'var(--volt)' },
    { n: count('type'), label: 'prompt exercises', color: 'var(--volt)' },
    { n: count('code'), label: 'code exercises', color: 'var(--synapse)' },
    { n: count('video'), label: 'optional videos', color: 'var(--ion)' },
    { n: count('project'), label: 'checkpoint projects', color: 'var(--synapse)' },
  ]
    .filter((row) => row.n > 0)
    .map((row) => ({ ...row, label: row.n === 1 ? singular(row.label) : row.label }))

  return {
    course,
    lead: course.lead ?? course.desc,
    signedIn,
    soon,
    state,
    pct: course.pct,
    done,
    total,
    totalMins,
    minsLeft,
    cta,
    secondary,
    loginHref: signedIn || soon ? undefined : options.loginHref,
    modules,
    learn,
    neurons: all.reduce((sum, l) => sum + l.xp, 0),
    source: {
      files: total + 1,
      path: `content/courses/${course.slug}/`,
      href: `${COURSE_SOURCE_TREE}/${course.slug}`,
      author: course.authors.join(', ') || DEFAULT_AUTHOR,
      updated: course.updated ?? DEFAULT_UPDATED,
      verified: course.verified,
    },
  }
}

function singular(label: string): string {
  return label
    .replace(/^lessons, every one a chat/, 'lesson, a chat')
    .replace(/^chat lessons$/, 'chat lesson')
    .replace(/exercises$/, 'exercise')
    .replace(/videos$/, 'video')
    .replace(/projects$/, 'project')
}

/**
 * The course to offer after this one: the next unfinished course in path
 * order, wrapping round to the start; none when every other one is done.
 */
export function pickNextCourse(slug: string, list: readonly CourseSummary[]): CourseSummary | undefined {
  let index = list.findIndex((course) => course.slug === slug)
  let after = [...list.slice(index + 1), ...list.slice(0, Math.max(index, 0))]
  return after.find((course) => course.pct < 100 && !isComingSoon(course))
}

/** "55 min", or "1 h 10 min" from the hour. */
export function formatMins(mins: number): string {
  if (mins < 60) return `${mins} min`
  let h = Math.floor(mins / 60)
  let m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "3 Nov 2026": the freshness date on lesson and course pages (decision 073). */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
