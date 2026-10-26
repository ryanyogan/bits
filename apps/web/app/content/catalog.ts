// The courses a request can see, with the viewer's progress applied on
// demand. Built per request by app/content/store.ts from the published
// manifests (or from one draft build for the author preview); lesson bodies
// load lazily through `lessonContent`.
import type { LessonContent } from '../actions/courses/lesson/content.ts'
import {
  NO_PROGRESS,
  type Completed,
  type CourseDetail,
  type CourseManifest,
  type CourseSummary,
  type LessonInfo,
  type LessonSummary,
} from './types.ts'

/** Loads one lesson body of a catalog course, or undefined when it's missing. */
export type LessonLoader = (course: CourseManifest, lessonSlug: string) => Promise<LessonContent | undefined>

export interface FoundLesson {
  course: CourseDetail
  lesson: LessonSummary
  index: number
  total: number
  prev?: LessonSummary
  next?: LessonSummary
}

export class Catalog {
  readonly courses: readonly CourseManifest[]
  #bySlug: Map<string, CourseManifest>
  #load: LessonLoader

  constructor(courses: readonly CourseManifest[], load: LessonLoader) {
    this.courses = courses
    this.#bySlug = new Map(courses.map((course) => [course.slug, course]))
    this.#load = load
  }

  has(slug: string): boolean {
    return this.#bySlug.has(slug)
  }

  /**
   * A course with the viewer's progress applied: completed lessons are done,
   * the first unfinished lesson of a started course is current, the rest next.
   */
  getCourse(slug: string, completed: Completed = NO_PROGRESS): CourseDetail | undefined {
    let info = this.#bySlug.get(slug)
    if (!info) return undefined
    let isDone = (l: LessonInfo) => completed.has(`${info.slug}/${l.slug}`)
    let all = info.modules.flatMap((m) => m.lessons)
    let done = all.filter(isDone).length
    let current = done > 0 ? all.find((l) => !isDone(l)) : undefined
    return {
      ...info,
      // Floor: never show more progress than there is (5 of 8 is 62%).
      pct: all.length ? Math.floor((done / all.length) * 100) : 0,
      modules: info.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({ ...l, state: isDone(l) ? 'done' : l === current ? 'current' : 'next' })),
      })),
    }
  }

  /** Every course with the viewer's progress, in catalog order. */
  listCourses(completed: Completed = NO_PROGRESS): CourseSummary[] {
    return this.courses.map((info) => {
      let { outcomes, modules, badge, lead, authors, introLabel, exercise, updated, videos, ...summary } = this.getCourse(
        info.slug,
        completed,
      )!
      return summary
    })
  }

  getLesson(courseSlug: string, lessonSlug: string, completed: Completed = NO_PROGRESS): FoundLesson | undefined {
    let course = this.getCourse(courseSlug, completed)
    if (!course) return undefined
    let all = course.modules.flatMap((m) => m.lessons)
    let index = all.findIndex((l) => l.slug === lessonSlug)
    if (index < 0) return undefined
    return { course, lesson: all[index]!, index, total: all.length, prev: all[index - 1], next: all[index + 1] }
  }

  /**
   * The Continue banner target: the course of the most recently completed
   * lesson that still has lessons left, at its current lesson.
   */
  getContinue(completed: Completed) {
    let recent = [...completed].sort((a, b) => b[1] - a[1])
    let seen = new Set<string>()
    for (let [key] of recent) {
      let slug = key.slice(0, key.indexOf('/'))
      if (seen.has(slug)) continue
      seen.add(slug)
      let course = this.getCourse(slug, completed)
      if (!course) continue
      let lessons = course.modules.flatMap((m) => m.lessons)
      let current = lessons.find((l) => l.state === 'current')
      if (current) return { course, lesson: current, total: lessons.length }
    }
    return undefined
  }

  /** The compiled lesson body, or undefined when the course or lesson doesn't exist. */
  async lessonContent(courseSlug: string, lessonSlug: string): Promise<LessonContent | undefined> {
    let course = this.#bySlug.get(courseSlug)
    if (!course || !course.modules.some((m) => m.lessons.some((l) => l.slug === lessonSlug))) return undefined
    return this.#load(course, lessonSlug)
  }
}
