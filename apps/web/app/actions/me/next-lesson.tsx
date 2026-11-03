// /me's first band (decision 068): "My learning" answers "what do I do
// next?" before "who am I?". The current lesson of the most recent course in
// progress, or lesson 1 for an account with nothing done yet. A learner whose
// started courses are all finished gets no band: the course list is next.
import type { Handle } from 'remix/component'
import { ContinueBanner } from '@bits/ui/continue-banner'
import { RuledSection } from '@bits/ui/ruled-section'

import type { Catalog } from '../../content/catalog.ts'
import type { Completed } from '../../content/types.ts'
import { routes } from '../../routes.ts'
import type { ContinueTarget } from '../courses/catalog-page.tsx'
import { LESSON_ONE } from '../home/links.ts'

export interface NextLesson extends ContinueTarget {
  /** `resume`: a course in progress. `start`: nothing done yet. */
  kind: 'resume' | 'start'
}

type Course = NonNullable<ReturnType<Catalog['getCourse']>>
type Lesson = Course['modules'][number]['lessons'][number]

export function nextLesson(catalog: Catalog, completed: Completed): NextLesson | undefined {
  let resume = catalog.getContinue(completed)
  if (resume) return target('resume', resume.course, resume.lesson, resume.total)
  if (completed.size > 0) return undefined
  let course = catalog.getCourse(LESSON_ONE.course, completed) ?? catalog.getCourse(catalog.courses[0]?.slug ?? '', completed)
  let lessons = course?.modules.flatMap((m) => m.lessons) ?? []
  return course && lessons[0] ? target('start', course, lessons[0], lessons.length) : undefined
}

function target(kind: NextLesson['kind'], course: Course, lesson: Lesson, total: number): NextLesson {
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

/** The band: joined under the app bar, the banner rail to rail. */
export function NextLessonBand(handle: Handle<{ next: NextLesson }>) {
  return () => {
    let { next } = handle.props
    let eyebrow =
      next.kind === 'start' ? `Start here · lesson 1 of ${next.total}` : `Continue · lesson ${next.n} of ${next.total}`
    return (
      <RuledSection aria-label={next.kind === 'start' ? 'Start here' : 'Continue where you left off'} rule={false} pad="none">
        <ContinueBanner
          href={next.href}
          courseTitle={next.courseTitle}
          eyebrow={eyebrow}
          nextLesson={next.lessonTitle}
          mins={next.mins}
          pct={next.pct}
          sigil={next.sigil}
          tone={next.tone}
          pattern={next.pattern}
          edge="flush"
        />
      </RuledSection>
    )
  }
}
