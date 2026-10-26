// Server-side lesson checks. Never trust the client's XP: when a lesson is
// completed, the server re-runs every exercise's checks against the prompt
// the learner submitted and grades quizzes itself, then decides the awards.
import type { XpKind } from '@bits/db'
import { checkPasses } from '@bits/ui/prompt-composer'

import { exercisesOf, type LessonContent, type QuizBlock } from '../actions/courses/lesson/content.ts'
import { fieldNames, offeredTemperatures, promptChecks } from '../actions/courses/lesson/ui/exercise.ts'

export const MAX_PROMPT_LENGTH = 4000

/** What the "Complete lesson" form carries (field names in `fieldNames`). */
export interface LessonSubmission {
  /** Exercise id → the learner's prompt. */
  prompts: Record<string, string>
  /**
   * Exercise id → temperatures run at (× 100). Never read from the form:
   * filled from the journal of runs (`/api/run`, decision 019).
   */
  ran: Record<string, number[]>
  /** Quiz id → picked option keys. */
  quizzes: Record<string, string[]>
}

/** Reads only the fields this lesson's exercises and quizzes define. */
export function readSubmission(formData: FormData, content: LessonContent): LessonSubmission {
  let submission: LessonSubmission = { prompts: {}, ran: {}, quizzes: {} }
  for (let block of content.blocks) {
    if (block.type === 'prompt') {
      let prompt = formData.get(fieldNames.prompt(block.id))
      if (typeof prompt === 'string') submission.prompts[block.id] = prompt.slice(0, MAX_PROMPT_LENGTH)
    } else if (block.type === 'quiz') {
      let keys = new Set(block.options.map((option) => option.key))
      let picked = formData.getAll(fieldNames.quiz(block.id)).filter((v): v is string => typeof v === 'string' && keys.has(v))
      if (picked.length) submission.quizzes[block.id] = [...new Set(picked)]
    }
  }
  return submission
}

export interface CheckedExercise {
  exerciseId: string
  task: string
  prompt: string
  temperatures: number[]
  passed: boolean
  /** Labels of the checks that failed. */
  failed: string[]
}

export interface Award {
  kind: XpKind
  ref: string
  xp: number
}

export interface CheckedLesson {
  /** Every exercise passed: the lesson can be completed. */
  ok: boolean
  exercises: CheckedExercise[]
  awards: Award[]
}

export function quizCorrect(block: QuizBlock, picked: string[] | undefined): boolean {
  if (!picked?.length) return false
  let correct = block.options.filter((option) => option.correct).map((option) => option.key)
  return correct.length === picked.length && correct.every((key) => picked.includes(key))
}

/**
 * Grades a submission for course/lesson. Awards: each passed exercise and
 * correct quiz earns its own xp; completing the lesson earns the rest of the
 * lesson's xp, so a lesson is worth its frontmatter `xp` in total.
 */
export function checkLesson(courseSlug: string, lessonSlug: string, content: LessonContent, submission: LessonSubmission): CheckedLesson {
  let base = `${courseSlug}/${lessonSlug}`
  let exercises = exercisesOf(content).map((block): CheckedExercise => {
    let prompt = submission.prompts[block.id] ?? ''
    let offered = new Set(offeredTemperatures(block))
    let temperatures = (submission.ran[block.id] ?? []).filter((t) => offered.has(t))
    let ranAt = new Set(temperatures)
    let failed = prompt.trim()
      ? promptChecks(block)
          .filter((check) => !checkPasses(check, prompt, ranAt))
          .map((check) => check.label)
      : promptChecks(block).map((check) => check.label)
    return { exerciseId: block.id, task: block.task, prompt, temperatures, passed: failed.length === 0, failed }
  })

  let awards: Award[] = []
  let earmarked = 0
  for (let block of content.blocks) {
    if (block.type === 'prompt') {
      earmarked += block.xp
      if (exercises.find((e) => e.exerciseId === block.id)?.passed) {
        awards.push({ kind: 'exercise', ref: `${base}/${block.id}`, xp: block.xp })
      }
    } else if (block.type === 'quiz') {
      earmarked += block.xp
      if (quizCorrect(block, submission.quizzes[block.id])) {
        awards.push({ kind: 'quiz', ref: `${base}/${block.id}`, xp: block.xp })
      }
    }
  }
  let ok = exercises.every((exercise) => exercise.passed)
  if (ok) awards.push({ kind: 'lesson', ref: base, xp: Math.max(0, content.xp - earmarked) })
  return { ok, exercises, awards }
}
