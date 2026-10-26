// Where the landing page's calls to action go. Derived from the sample
// fixtures so the links follow the catalogue when it changes.
import { courses, getCourse } from '../../data/fixtures.ts'
import { routes } from '../../routes.ts'

/** The first lesson of the first course: "lesson 1" everywhere on the page. */
export function lessonOne(): { course: string; lesson: string } {
  let course = getCourse(courses[0]!.slug)
  let lesson = course?.modules[0]?.lessons[0]
  return course && lesson
    ? { course: course.slug, lesson: lesson.slug }
    : { course: 'tokens-and-temperature', lesson: 'what-is-a-token' }
}

/** Lesson 1, optionally with a prompt to prefill (`?q=`). */
export function lessonOneHref(q?: string): string {
  return routes.courses.lesson.index.href(lessonOne(), q ? { searchParams: { q } } : undefined)
}

/** The agent-loop lesson in Terminal mode (the CodeLesson artboard). */
export function agentLessonHref(q?: string): string {
  let course = getCourse('first-agent-loop')
  let lessons = course?.modules.flatMap((m) => m.lessons) ?? []
  let lesson = lessons.find((l) => l.slug === 'the-loop') ?? lessons[0]
  if (!course || !lesson) return lessonOneHref(q)
  let searchParams: Record<string, string> = { mode: 'terminal' }
  if (q) searchParams.q = q
  return routes.courses.lesson.index.href({ course: course.slug, lesson: lesson.slug }, { searchParams })
}

export function trackHref(track: 'foundations' | 'prompting' | 'tools' | 'agents'): string {
  return routes.courses.index.href(undefined, { searchParams: { track } })
}

/** "See your profile →": /me (signed-out visitors sign in first). */
export function profileHref(): string {
  return routes.me.index.href()
}
