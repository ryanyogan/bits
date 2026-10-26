// Builds everything the lesson page renders from the URL: the course and
// lesson fixtures, the compiled content, the mode, and every href. Shared by
// /courses/:course/:lesson and the author preview /author/:course/preview/:lesson.
import type { CourseDetail, LessonSummary, Viewer } from '../../../data/fixtures.ts'
import { getLesson } from '../../../data/fixtures.ts'
import { routes } from '../../../routes.ts'
import { exercisesOf, type LessonContent } from './content.ts'
import { getLessonContent, resumeAt } from './fixtures.ts'

export type LessonMode = 'read' | 'watch' | 'terminal'

export interface LessonView {
  /** course/lesson (prefixed `preview/` for drafts): keys drafts and passes in the browser. */
  key: string
  course: CourseDetail
  lesson: LessonSummary
  /** Flat list of the course's lessons, in order. */
  lessons: LessonSummary[]
  index: number
  total: number
  prev?: LessonSummary
  next?: LessonSummary
  content: LessonContent
  mode: LessonMode
  viewer: Viewer | null
  /** Watch-mode resume position, seconds. */
  resumeAt?: number
  /** Answers to quizzes submitted with the GET form: quiz id → option keys. */
  answers: Record<string, string[]>
  /** The author draft preview. */
  draft?: { version: string; backHref: string }
  href: {
    /** This lesson in a mode. */
    mode(mode: LessonMode): string
    /** Another lesson of the course (its default mode). */
    lesson(slug: string): string
    back: string
    login: string
    /** Path of this page, for GET forms. */
    self: string
  }
}

export interface LessonViewOptions {
  /** Render as the author's draft preview. */
  draft?: { version: string }
  /** The signed-in viewer, or null. */
  viewer?: Viewer | null
}

const MODES: LessonMode[] = ['read', 'watch', 'terminal']

/** Returns undefined when the course or lesson doesn't exist. */
export function buildLessonView(courseSlug: string, lessonSlug: string, url: URL, options: LessonViewOptions = {}): LessonView | undefined {
  let found = getLesson(courseSlug, lessonSlug)
  if (!found) return undefined
  let { course, lesson, index, total, prev, next } = found
  let content = getLessonContent(course.slug, lesson)
  let requested = url.searchParams.get('mode') as LessonMode | null
  let mode: LessonMode = requested && MODES.includes(requested) ? requested : 'read'
  if (mode === 'watch' && !content.video) mode = 'read'
  let preview = Boolean(options.draft)
  let lessonHref = (slug: string, m?: LessonMode) => {
    let searchParams = m ? { mode: m } : undefined
    return preview
      ? routes.author.course.preview.href({ course: course.slug, lesson: slug }, { searchParams })
      : routes.courses.lesson.index.href({ course: course.slug, lesson: slug }, { searchParams })
  }

  let answers: Record<string, string[]> = {}
  for (let block of content.blocks) {
    if (block.type !== 'quiz') continue
    let picked = url.searchParams.getAll(`quiz-${block.id}`)
    if (picked.length) answers[block.id] = picked
  }

  let self = lessonHref(lesson.slug)
  return {
    key: `${preview ? 'preview/' : ''}${course.slug}/${lesson.slug}`,
    course,
    lesson,
    lessons: course.modules.flatMap((m) => m.lessons),
    index,
    total,
    prev,
    next,
    content,
    mode,
    viewer: options.viewer ?? null,
    resumeAt: resumeAt[`${course.slug}/${lesson.slug}`],
    answers,
    draft: options.draft
      ? { version: options.draft.version, backHref: routes.author.course.index.href({ course: course.slug }) }
      : undefined,
    href: {
      mode: (m) => lessonHref(lesson.slug, m),
      lesson: (slug) => lessonHref(slug),
      back: preview
        ? routes.author.course.index.href({ course: course.slug })
        : routes.courses.course.index.href({ course: course.slug }),
      login: routes.login.index.href(undefined, { searchParams: { next: url.pathname + url.search } }),
      self,
    },
  }
}

/** Neurons awarded by this lesson's exercises. */
export function lessonAward(view: LessonView): number {
  return exercisesOf(view.content).reduce((sum, exercise) => sum + exercise.xp, 0)
}
