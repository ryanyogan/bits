// View model for /courses/:course. Turns the shared fixtures (or, later, the
// compiled course + progress) into exactly what the page draws, so the
// components stay dumb and the rules live in one testable place.
import type { CourseDetail, LessonKind, LessonSummary, Viewer } from '../../../data/fixtures.ts'
import type { LessonState } from '@bits/ui/lesson-node'

/** Copy the shared fixtures don't carry yet (lead, resume point, authorship). */
interface CourseExtras {
  lead?: string
  /** Shown as the secondary hero CTA when the first lesson has a video. */
  introLabel?: string
  /** "You stopped at the exercise: …" under the current lesson. */
  exercise?: string
  author?: string
  /** ISO date of the published version. */
  updated?: string
}

const extras: Record<string, CourseExtras> = {
  'tokens-and-temperature': {
    lead: "Why the same prompt gives different answers — and how to dial randomness up or down on purpose. You'll tokenize sentences, read probability tables and tune a chatbot from boring to unhinged.",
    introLabel: 'Watch the 90-second intro',
    exercise: 'make the model write the same tagline at temperature 0 and 1, then explain the difference.',
    author: 'Mira Okafor',
    updated: '2026-10-12',
  },
  'first-agent-loop': {
    lead: 'Plan, act, observe, repeat. You will write the thirty lines of code every agent is built on, give it tools, and learn to stop a loop that never ends.',
    introLabel: 'Watch the 2-minute intro',
    exercise: 'finish the loop so it feeds each tool result back to the model until it stops asking.',
    author: 'Dev Arora',
    updated: '2026-10-03',
  },
}

const DEFAULT_AUTHOR = 'The bits team'
const DEFAULT_UPDATED = '2026-09-28'

export const kindLabels: Record<LessonKind, { glyph: string; label: string; color: string }> = {
  chat: { glyph: '▸', label: 'chat', color: 'var(--muted)' },
  type: { glyph: '›', label: 'type', color: 'var(--volt)' },
  video: { glyph: '▶', label: 'video', color: 'var(--ion)' },
  code: { glyph: '{ }', label: 'code', color: 'var(--synapse)' },
  project: { glyph: '◆', label: 'project', color: 'var(--synapse)' },
}

export interface SyllabusLesson extends LessonSummary {
  href: string
  /**
   * Trace segment from this node down to the next one in the module; `tail`
   * runs from the last (current) node down beside its resume callout.
   */
  trace: 'done' | 'todo' | 'tail' | 'none'
  /** The current lesson carries the resume callout (signed in only). */
  resume?: { exercise?: string; href: string }
}

export interface SyllabusModuleView {
  n: string
  title: string
  lessons: SyllabusLesson[]
}

export interface CourseView {
  course: CourseDetail
  lead: string
  signedIn: boolean
  pct: number
  done: number
  total: number
  minsLeft: number
  /** Primary CTA. */
  cta: { label: string; href: string }
  intro?: { label: string; href: string }
  modules: SyllabusModuleView[]
  learn: { n: number; label: string; color: string }[]
  neurons: number
  source: { files: number; path: string; author: string; updated: string }
}

type LessonHref = (lesson: string, mode?: 'watch') => string

/**
 * `course` carries the viewer's progress (D1 when signed in, the session
 * when not): lesson states and pct come from getCourse(slug, completed).
 */
export function buildCourseView(course: CourseDetail, viewer: Viewer | null, lessonHref: LessonHref): CourseView {
  let signedIn = viewer !== null
  let info = extras[course.slug] ?? {}
  let all = course.modules.flatMap((m) => m.lessons)
  let stateOf = (lesson: LessonSummary): LessonState => lesson.state

  let done = all.filter((l) => stateOf(l) === 'done').length
  let total = all.length
  let current = all.find((l) => stateOf(l) === 'current')
  let firstOpen = current ?? all.find((l) => stateOf(l) !== 'done')
  let pct = course.pct
  let remaining = all.filter((l) => stateOf(l) !== 'done').reduce((sum, l) => sum + l.mins, 0)
  // "about 20 min to go": round down to 5 so the estimate never overshoots.
  let minsLeft = remaining === 0 ? 0 : Math.max(5, Math.floor(remaining / 5) * 5)

  let cta =
    done === 0 && !current
      ? { label: 'Start lesson 1 →', href: lessonHref(all[0]!.slug) }
      : firstOpen
        ? { label: `Resume lesson ${firstOpen.n} →`, href: lessonHref(firstOpen.slug) }
        : { label: 'Review the course →', href: lessonHref(all[0]!.slug) }

  let first = all[0]!
  let intro =
    info.introLabel && first.kinds.includes('video')
      ? { label: info.introLabel, href: lessonHref(first.slug, 'watch') }
      : undefined

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
        : state === 'current'
          ? 'tail'
          : 'none'
      return {
        ...lesson,
        state,
        href: lessonHref(lesson.slug),
        trace,
        resume: state === 'current' ? { exercise: info.exercise, href: lessonHref(lesson.slug) } : undefined,
      }
    }),
  }))

  // Code inside a checkpoint project counts as the project, not a separate exercise.
  let count = (kind: LessonKind) =>
    all.filter((l) => l.kinds.includes(kind) && !(kind === 'code' && l.kinds.includes('project'))).length
  let chat = count('chat')
  let learn = [
    { n: chat, label: chat === total ? 'chat lessons — every one' : chat === 1 ? 'chat lesson' : 'chat lessons', color: 'var(--volt)' },
    { n: count('type'), label: 'typed prompt exercises', color: 'var(--volt)' },
    { n: count('code'), label: 'code exercises', color: 'var(--synapse)' },
    { n: count('video'), label: 'optional videos', color: 'var(--ion)' },
    { n: count('project'), label: 'checkpoint project', color: 'var(--synapse)' },
  ]
    .filter((row) => row.n > 0)
    .map((row) => ({
      ...row,
      label:
        row.n === 1
          ? row.label.replace(/exercises$/, 'exercise').replace(/videos$/, 'video')
          : row.label.replace(/project$/, 'projects'),
    }))

  return {
    course,
    lead: info.lead ?? course.desc,
    signedIn,
    pct,
    done,
    total,
    minsLeft,
    cta,
    intro,
    modules,
    learn,
    neurons: all.reduce((sum, l) => sum + l.xp, 0),
    source: {
      files: total + 1,
      path: `courses/${course.slug}/`,
      author: info.author ?? DEFAULT_AUTHOR,
      updated: info.updated ?? DEFAULT_UPDATED,
    },
  }
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
