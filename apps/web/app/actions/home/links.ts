// Where the landing and sign-in pages' calls to action go. Fixed lesson
// URLs, so these pages render without loading the catalog; the lessons are
// in content/courses/ (home.test.ts checks each one exists).
import { routes } from '../../routes.ts'

/** "Lesson 1" everywhere: the first lesson of the first course. */
export const LESSON_ONE = { course: 'what-is-an-llm', lesson: 'say-hi-to-claude' } as const

export function lessonOne(): { course: string; lesson: string } {
  return LESSON_ONE
}

/** Lesson 1 (content/courses/what-is-an-llm/01-say-hi-to-claude.md). */
export function lessonOneHref(): string {
  return routes.courses.lesson.index.href(lessonOne())
}

/**
 * The hero's questions (decision 065), each a link to the lesson that
 * answers it. Never a box to type into: nothing typed there would reach a
 * lesson, so the hero only promises what a click delivers.
 */
export const heroQuestions = [
  { label: 'What’s a token, really?', course: 'what-is-an-llm', lesson: 'words-become-tokens' },
  { label: 'Why do models make things up?', course: 'what-is-an-llm', lesson: 'what-it-cant-do' },
  { label: 'What makes an agent an agent?', course: 'first-agent-loop', lesson: 'agents-are-loops' },
] as const

export function questionHref(question: (typeof heroQuestions)[number]): string {
  return routes.courses.lesson.index.href({ course: question.course, lesson: question.lesson })
}

export function trackHref(track: 'foundations' | 'prompting' | 'tools' | 'agents'): string {
  return routes.courses.index.href(undefined, { searchParams: { track } })
}
