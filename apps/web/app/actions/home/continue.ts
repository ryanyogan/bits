// "Continue" for a signed-in learner (decision 065): the next lesson, from
// the same catalog and progress helpers the course list's banner uses.
import type { Catalog } from '../../content/catalog.ts'
import type { Completed } from '../../content/types.ts'
import { routes } from '../../routes.ts'
import type { ContinueTarget } from '../courses/catalog-page.tsx'
import { LESSON_ONE } from './links.ts'

export interface NextStep extends ContinueTarget {
  /** `resume`: a course in progress. `start`: nothing done yet, so lesson 1. */
  kind: 'resume' | 'start'
}

/**
 * Where this learner goes next: the current lesson of their most recent
 * course in progress, else lesson 1 when they have done nothing yet.
 * Undefined when lessons are done but none is left to resume (every course
 * they started is finished): the course list is the next step then.
 */
export function nextStep(catalog: Catalog, completed: Completed): NextStep | undefined {
  let resume = catalog.getContinue(completed)
  if (resume) return target('resume', resume.course, resume.lesson, resume.total)
  if (completed.size > 0) return undefined
  let course = catalog.getCourse(LESSON_ONE.course, completed) ?? catalog.getCourse(catalog.courses[0]?.slug ?? '', completed)
  let lessons = course?.modules.flatMap((m) => m.lessons) ?? []
  let first = lessons[0]
  return course && first ? target('start', course, first, lessons.length) : undefined
}

type Course = NonNullable<ReturnType<Catalog['getCourse']>>
type Lesson = Course['modules'][number]['lessons'][number]

function target(kind: NextStep['kind'], course: Course, lesson: Lesson, total: number): NextStep {
  return {
    kind,
    href: routes.courses.lesson.index.href({ course: course.slug, lesson: lesson.slug }),
    courseTitle: course.title,
    lessonTitle: lesson.title,
    n: lesson.n,
    total,
    mins: lesson.mins,
    pct: course.pct,
    sigil: course.sigil,
    tone: course.tone,
    pattern: course.pattern,
  }
}

/** Where `GET /continue` sends this learner: the next lesson, or the course list. */
export function continueHref(catalog: Catalog, completed: Completed): string {
  return nextStep(catalog, completed)?.href ?? routes.courses.index.href()
}
