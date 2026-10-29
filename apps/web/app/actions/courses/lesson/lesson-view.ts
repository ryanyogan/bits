// Builds everything the lesson page renders from the URL: the course and
// lesson from the catalog, the compiled content, the depth, and every href.
// A lesson has one view, Read (decision 055): an old `?mode=` link is ignored.
// Shared by /courses/:course/:lesson (the published catalog) and the author
// preview /author/:course/preview/:lesson (a catalog of the draft build).
import type { Viewer } from '../../../auth/identity.ts'
import type { Catalog } from '../../../content/catalog.ts'
import type { SavedDraft } from '@bits/db'
import type { AskVerdict } from '@bits/ui/lib/ask-client'
import type { Completed, CourseDetail, LessonSummary } from '../../../content/types.ts'
import { routes } from '../../../routes.ts'
import {
  contentAtDepth,
  DEFAULT_DEPTH,
  depthsOf,
  exercisesOf,
  gatingAsksOf,
  isLessonDepth,
  type LessonContent,
  type LessonDepth,
} from './content.ts'

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
  /** The lesson at `depth`: shared blocks plus that depth's (decision 053). */
  content: LessonContent
  /** The depth this page renders at. */
  depth: LessonDepth
  /** The depths the lesson's blocks are tagged with; empty when it has none (no depth control). */
  depths: LessonDepth[]
  viewer: Viewer | null
  /** The video's resume position, seconds (the saved `video` draft; the browser's own copy can be newer). */
  resumeAt?: number
  /** The signed-in viewer's saved drafts in this lesson, by key (decision 029). */
  drafts: Record<string, SavedDraft>
  /** Where the browser saves drafts; absent when signed out or in the draft preview. */
  draftSync?: { action: string; fields: Record<string, string> }
  /**
   * Quick checks (decision 052) this browser has answered right, and the
   * verdict a native (no-JS) answer was redirected back with. Both come from
   * the session; the save reads the journal instead.
   */
  asks: LessonAsks
  /** The author draft preview. */
  draft?: { version: string; backHref: string }
  /** The "complete lesson" form (absent in the draft preview). */
  completeForm?: { id: string; action: string }
  href: {
    /** This page at a depth: the current URL with `?depth=` set, its other params kept. */
    depth(depth: LessonDepth): string
    /** Another lesson of the course. */
    lesson(slug: string): string
    back: string
    login: string
    /** Path of this page, for GET forms. */
    self: string
  }
}

export interface LessonAsks {
  passed: string[]
  verdict?: { ask: string; verdict: AskVerdict }
}

export interface LessonViewOptions {
  /** Asks answered right and a flashed verdict (from the session; none in the draft preview). */
  asks?: LessonAsks
  /** Render as the author's draft preview. */
  draft?: { version: string }
  /** The signed-in viewer, or null. */
  viewer?: Viewer | null
  /** The viewer's completed lessons (lesson states, the done segment). */
  completed?: Completed
  /** The signed-in viewer's saved drafts in this lesson (undefined when signed out). */
  drafts?: Record<string, SavedDraft>
  /** The depth to render at (`lessonDepth(context)`); else the URL's `?depth=`, else `new`. */
  depth?: LessonDepth
}

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
  let full = await catalog.lessonContent(course.slug, lesson.slug)
  if (!full) return undefined
  let asked = url.searchParams.get('depth')
  let depth = options.depth ?? (isLessonDepth(asked) ? asked : DEFAULT_DEPTH)
  let content = contentAtDepth(full, depth)
  let preview = Boolean(options.draft)
  let lessonHref = (slug: string) =>
    preview
      ? routes.author.course.preview.href({ course: course.slug, lesson: slug })
      : routes.courses.lesson.index.href({ course: course.slug, lesson: slug })

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
    depth,
    depths: depthsOf(full.blocks),
    viewer: options.viewer ?? null,
    resumeAt: Number.isFinite(resumeAt) && resumeAt > 0 ? resumeAt : undefined,
    drafts,
    draftSync:
      !preview && options.drafts
        ? { action: routes.api.drafts.href(), fields: { course: course.slug, lesson: lesson.slug } }
        : undefined,
    asks: (!preview && options.asks) || { passed: [] },
    draft: options.draft
      ? { version: options.draft.version, backHref: routes.author.course.index.href({ course: course.slug }) }
      : undefined,
    completeForm: preview
      ? undefined
      : { id: 'lesson-complete', action: routes.courses.lesson.complete.href({ course: course.slug, lesson: lesson.slug }) },
    href: {
      depth: (d) => {
        let params = new URLSearchParams(url.search)
        // `mode` is gone (decision 055); don't carry an old one forward.
        params.delete('mode')
        params.set('depth', d)
        return `${url.pathname}?${params}`
      },
      lesson: (slug) => lessonHref(slug),
      back: preview
        ? routes.author.course.index.href({ course: course.slug })
        : routes.courses.course.index.href({ course: course.slug }),
      login: routes.login.index.href(undefined, { searchParams: { next: url.pathname + url.search } }),
      self,
    },
  }
}

const depthLabels: Record<LessonDepth, string> = { new: 'New to this', engineer: 'Engineer' }

/**
 * The depth control's tabs (decision 053), or none when the lesson has no
 * depth blocks. They never prefetch: following one remembers the choice,
 * and a speculative GET on hover must not (decision 042).
 */
export function depthTabs(view: LessonView): { label: string; href: string; current: boolean; prefetch: false }[] {
  if (!view.depths.length) return []
  return (['new', 'engineer'] as const).map((depth) => ({
    label: depthLabels[depth],
    href: view.href.depth(depth),
    current: depth === view.depth,
    prefetch: false,
  }))
}

/** Neurons awarded by this lesson's prompt exercises (an ask reports its own, from the server). */
export function lessonAward(view: LessonView): number {
  return exercisesOf(view.content).reduce((sum, exercise) => sum + exercise.xp, 0)
}

/** Gating asks this browser hasn't answered right yet: what "Complete lesson" still waits for. */
export function openAsks(view: LessonView): string[] {
  return gatingAsksOf(view.content)
    .map((ask) => ask.id)
    .filter((id) => !view.asks.passed.includes(id) && !(view.asks.verdict?.ask === id && view.asks.verdict.verdict.correct))
}
