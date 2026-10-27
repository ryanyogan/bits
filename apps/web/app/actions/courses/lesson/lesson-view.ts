// Builds everything the lesson page renders from the URL: the course and
// lesson from the catalog, the compiled content, the mode, and every href.
// Shared by /courses/:course/:lesson (the published catalog) and the author
// preview /author/:course/preview/:lesson (a catalog of the draft build).
import type { Viewer } from '../../../auth/identity.ts'
import type { Catalog } from '../../../content/catalog.ts'
import type { SavedDraft } from '@bits/db'
import type { Completed, CourseDetail, LessonSummary } from '../../../content/types.ts'
import { routes } from '../../../routes.ts'
import { exercisesOf, hasVideo, type LessonContent } from './content.ts'

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
  /** Watch-mode resume position, seconds (the saved `video` draft; the browser's own copy can be newer). */
  resumeAt?: number
  /** The signed-in viewer's saved drafts in this lesson, by key (decision 029). */
  drafts: Record<string, SavedDraft>
  /** Where the browser saves drafts; absent when signed out or in the draft preview. */
  draftSync?: { action: string; fields: Record<string, string> }
  /** Answers to quizzes submitted with the GET form: quiz id → option keys. */
  answers: Record<string, string[]>
  /** The author draft preview. */
  draft?: { version: string; backHref: string }
  /** The "complete lesson" form (absent in the draft preview). */
  completeForm?: { id: string; action: string }
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
  /** The viewer's completed lessons (lesson states, the done segment). */
  completed?: Completed
  /** The signed-in viewer's saved drafts in this lesson (undefined when signed out). */
  drafts?: Record<string, SavedDraft>
}

const MODES: LessonMode[] = ['read', 'watch', 'terminal']

/** Resolves undefined when the course or lesson doesn't exist. */
export async function buildLessonView(
  catalog: Catalog,
  courseSlug: string,
  lessonSlug: string,
  url: URL,
  options: LessonViewOptions = {},
): Promise<LessonView | undefined> {
  let found = catalog.getLesson(courseSlug, lessonSlug, options.completed)
  if (!found) return undefined
  let { course, lesson, index, total, prev, next } = found
  let content = await catalog.lessonContent(course.slug, lesson.slug)
  if (!content) return undefined
  let requested = url.searchParams.get('mode') as LessonMode | null
  let mode: LessonMode = requested && MODES.includes(requested) ? requested : 'read'
  if (mode === 'watch' && !hasVideo(content)) mode = 'read'
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
  let drafts = (!preview && options.drafts) || {}
  let resumeAt = Number(drafts.video?.value)
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
    resumeAt: Number.isFinite(resumeAt) && resumeAt > 0 ? resumeAt : undefined,
    drafts,
    draftSync:
      !preview && options.drafts
        ? { action: routes.api.drafts.href(), fields: { course: course.slug, lesson: lesson.slug } }
        : undefined,
    answers,
    draft: options.draft
      ? { version: options.draft.version, backHref: routes.author.course.index.href({ course: course.slug }) }
      : undefined,
    completeForm: preview
      ? undefined
      : { id: 'lesson-complete', action: routes.courses.lesson.complete.href({ course: course.slug, lesson: lesson.slug }) },
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
