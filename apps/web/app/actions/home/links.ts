// Where the landing and sign-in pages' calls to action go. Fixed lesson
// URLs, so these pages render without loading the catalog; the lessons are
// content/courses/what-is-an-llm/01-say-hi-to-claude.md and
// content/courses/first-agent-loop/03-the-loop.md.
import { routes } from '../../routes.ts'

/** "Lesson 1" everywhere: the first lesson of the first course. */
export const LESSON_ONE = { course: 'what-is-an-llm', lesson: 'say-hi-to-claude' } as const

/** The agent-loop lesson (the CodeLesson artboard). */
const AGENT_LESSON = { course: 'first-agent-loop', lesson: 'the-loop' } as const

export function lessonOne(): { course: string; lesson: string } {
  return LESSON_ONE
}

/** Lesson 1, optionally with a prompt to prefill (`?q=`). */
export function lessonOneHref(q?: string): string {
  return routes.courses.lesson.index.href(lessonOne(), q ? { searchParams: { q } } : undefined)
}

/** The agent-loop lesson (the CodeLesson artboard). */
export function agentLessonHref(q?: string): string {
  return routes.courses.lesson.index.href(AGENT_LESSON, q ? { searchParams: { q } } : undefined)
}

export function trackHref(track: 'foundations' | 'prompting' | 'tools' | 'agents'): string {
  return routes.courses.index.href(undefined, { searchParams: { track } })
}

/** "See your profile →": /me (signed-out visitors sign in first). */
export function profileHref(): string {
  return routes.me.index.href()
}
