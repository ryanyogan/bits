// Server-side lesson checks. Never trust the client's XP: when a lesson is
// completed, the server re-runs every exercise's checks against the prompt
// the learner submitted, reads ask verdicts from its own journal, then
// decides the awards.
import type { XpKind } from '@bits/db'
import { checkPasses } from '@bits/ui/prompt-composer'

import {
  exercisesOf,
  quizAsAsk,
  upgradeLessonContent,
  type AskBlock,
  type LessonContent,
  type QuizBlock,
} from '../actions/courses/lesson/content.ts'
import { fieldNames, offeredTemperatures, promptChecks } from '../actions/courses/lesson/ui/exercise.ts'
import { isSafePattern } from '../content/compile/regex.ts'
import { clampXp, MAX_BLOCK_XP, MAX_LESSON_XP } from '../content/limits.ts'
import { picksOf } from './ask.ts'

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
  /**
   * Ask id → answered right. Never read from the form: filled from the
   * journal of answers (`/api/ask`, decision 052). Absent in progress a
   * signed-out visitor saved before asks existed: their quizzes graded from
   * `quizzes` and didn't gate the lesson.
   */
  asks?: Record<string, boolean>
  /** Quiz id → picked option keys: only in progress saved before decision 052. */
  quizzes?: Record<string, string[]>
}

/**
 * Reads only the prompts this lesson's exercises define. Answers to asks
 * (`answer.<id>`) are never read here: the journal says which were right.
 */
export function readSubmission(formData: FormData, content: LessonContent): LessonSubmission {
  let submission: LessonSubmission = { prompts: {}, ran: {} }
  for (let block of exercisesOf(content)) {
    let prompt = formData.get(fieldNames.prompt(block.id))
    if (typeof prompt === 'string') submission.prompts[block.id] = prompt.slice(0, MAX_PROMPT_LENGTH)
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
  /** Every exercise passed and every gating ask is answered: the lesson can be completed. */
  ok: boolean
  exercises: CheckedExercise[]
  /** Gating asks with no right answer in the journal. */
  unanswered: AskBlock[]
  awards: Award[]
}

/**
 * Defence in depth for content stored before the check grammar (decision
 * 018): a pattern the build would now reject never runs on the server, and
 * its check fails.
 */
function patternsSafe(check: { patterns?: { source: string; flags?: string }[] }): boolean {
  return (check.patterns ?? []).every((pattern) => isSafePattern(pattern.source, pattern.flags))
}

/** A quiz answered with option keys (progress saved before decision 052). */
export function quizCorrect(block: QuizBlock | AskBlock, picked: string[] | undefined): boolean {
  if (!picked?.length) return false
  let ask = block.type === 'quiz' ? quizAsAsk(block) : block
  let picks = picked.flatMap((key) => picksOf(ask, key) ?? [])
  let right = ask.choices.filter((choice) => choice.correct)
  return picks.length === right.length && picks.every((choice) => choice.correct)
}

/**
 * Each prompt's and ask's share of the lesson's xp, in lesson order: its
 * own xp, clamped so the blocks never add up past the lesson's (the rest is
 * the completion award). Shared by the save and by /api/ask, so a late
 * answer earns what it would have earned with the save.
 */
export function blockShares(content: LessonContent): { lessonXp: number; shares: Map<string, number>; earmarked: number } {
  // The build already rejects xp outside the caps (content/limits.ts); clamp
  // again so stored content can never award more than a lesson's cap.
  let lessonXp = clampXp(content.xp, MAX_LESSON_XP)
  let shares = new Map<string, number>()
  let earmarked = 0
  for (let block of upgradeLessonContent(content).blocks) {
    if (block.type !== 'prompt' && block.type !== 'ask') continue
    let xp = Math.min(clampXp(block.xp, MAX_BLOCK_XP), Math.max(0, lessonXp - earmarked))
    earmarked += xp
    shares.set(block.id, xp)
  }
  return { lessonXp, shares, earmarked }
}

/**
 * Grades a submission for course/lesson. Awards: each passed exercise and
 * right ask earns its own xp; completing the lesson earns the rest of the
 * lesson's xp, so a lesson is worth its frontmatter `xp` in total, never more
 * than MAX_LESSON_XP however the content was stored.
 */
export function checkLesson(courseSlug: string, lessonSlug: string, stored: LessonContent, submission: LessonSubmission): CheckedLesson {
  let content = upgradeLessonContent(stored)
  let base = `${courseSlug}/${lessonSlug}`
  let exercises = exercisesOf(content).map((block): CheckedExercise => {
    let prompt = submission.prompts[block.id] ?? ''
    let offered = new Set(offeredTemperatures(block))
    let temperatures = (submission.ran[block.id] ?? []).filter((t) => offered.has(t))
    let ranAt = new Set(temperatures)
    let failed = prompt.trim()
      ? promptChecks(block)
          .filter((check) => !(patternsSafe(check) && checkPasses(check, prompt, ranAt)))
          .map((check) => check.label)
      : promptChecks(block).map((check) => check.label)
    return { exerciseId: block.id, task: block.task, prompt, temperatures, passed: failed.length === 0, failed }
  })

  let answered = (block: AskBlock) =>
    submission.asks ? submission.asks[block.id] === true : quizCorrect(block, submission.quizzes?.[block.id])
  let asks = content.blocks.filter((block): block is AskBlock => block.type === 'ask')
  // Progress saved before asks existed didn't wait for its quizzes.
  let unanswered = submission.asks ? asks.filter((block) => block.gate && !answered(block)) : []

  let { lessonXp, shares, earmarked } = blockShares(content)
  let awards: Award[] = []
  for (let block of content.blocks) {
    if (block.type !== 'prompt' && block.type !== 'ask') continue
    let passed = block.type === 'prompt' ? exercises.find((e) => e.exerciseId === block.id)?.passed : answered(block)
    if (passed) awards.push({ kind: block.type === 'prompt' ? 'exercise' : 'quiz', ref: `${base}/${block.id}`, xp: shares.get(block.id) ?? 0 })
  }
  let ok = exercises.every((exercise) => exercise.passed) && unanswered.length === 0
  if (ok) awards.push({ kind: 'lesson', ref: base, xp: lessonXp - earmarked })
  return { ok, exercises, unanswered, awards }
}
