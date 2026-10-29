// Grading an `:::ask` (decision 052). Server only: the patterns, the right
// choices and their explanations never reach the browser. Pure, so the
// /api/ask action, the lesson save and the tests share it.
import { checkPasses } from '@bits/ui/prompt-composer'

import type { AskBlock, AskChoice } from '../actions/courses/lesson/content.ts'
import { isSafePattern } from '../content/compile/regex.ts'
import { MAX_ANSWER_LENGTH } from '../content/limits.ts'

export interface AskCheckResult {
  label: string
  /** accept: matched (good). reject: matched (bad, shown with its feedback). */
  kind: 'accept' | 'reject'
  passed: boolean
}

export interface AskGrade {
  correct: boolean
  /** Choices the answer named, with whether each is right. */
  picks: { key: string; label: string; correct: boolean }[]
  /** accept checks (each passed or not), and any reject that matched. */
  checks: AskCheckResult[]
  /** What to tell the learner: the explanation when right, else feedback or the hint. */
  feedback: string
}

/** Lowercase letters and digits only, single-spaced: how typed text is compared with a choice. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A typed letter: "b", "(b)", "[b]", "b)" or "b.". */
function letterOf(text: string): string | undefined {
  return /^\s*[([]?\s*([a-z])\s*[)\].:]?\s*$/i.exec(text)?.[1]?.toLowerCase()
}

function choiceFor(choices: AskChoice[], text: string): AskChoice | undefined {
  let letter = letterOf(text)
  if (letter) {
    let byKey = choices.find((choice) => choice.key === letter)
    if (byKey) return byKey
  }
  let typed = normalizeAnswer(text)
  return typed ? choices.find((choice) => normalizeAnswer(choice.label) === typed) : undefined
}

/**
 * The choices an answer names: the whole answer as one choice, or (for a
 * `multiple` ask) a list split on commas, semicolons, new lines or "and".
 * Undefined when any part names no choice.
 */
export function picksOf(block: AskBlock, answer: string): AskChoice[] | undefined {
  if (!block.choices.length) return undefined
  let whole = choiceFor(block.choices, answer)
  if (whole) return [whole]
  if (!block.multiple) return undefined
  let parts = answer
    .split(/[,;\n]|\band\b|&/i)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return undefined
  let picks: AskChoice[] = []
  for (let part of parts) {
    let choice = choiceFor(block.choices, part)
    if (!choice) return undefined
    if (!picks.includes(choice)) picks.push(choice)
  }
  return picks
}

/** Defence in depth: a stored pattern outside the build's grammar never runs, and fails. */
function safe(check: { patterns: { source: string; flags?: string }[] }): boolean {
  return check.patterns.every((pattern) => isSafePattern(pattern.source, pattern.flags))
}

const NO_RAN = new Set<number>()
const VERDICT_LEAD = /^(?:right|correct|yes|exactly|not quite|nope|no)[.!,:]\s*/i

/**
 * Grades `answer`. Right when it names exactly the right choice(s), or when
 * every accept check matches and no reject does. A named wrong choice, a
 * matching reject or a missed accept is wrong, with its feedback (else the
 * hint).
 */
export function gradeAsk(block: AskBlock, rawAnswer: string): AskGrade {
  let answer = rawAnswer.slice(0, MAX_ANSWER_LENGTH).trim()
  let picks = picksOf(block, answer)
  let accept = block.accept.map(
    (check): AskCheckResult => ({ label: check.label, kind: 'accept', passed: safe(check) && checkPasses(check, answer, NO_RAN) }),
  )
  let rejected = block.reject.filter((check) => safe(check) && checkPasses(check, answer, NO_RAN))
  let checks = [...accept, ...rejected.map((check): AskCheckResult => ({ label: check.label, kind: 'reject', passed: false }))]
  let pickList = (picks ?? []).map((choice) => ({ key: choice.key, label: choice.label, correct: choice.correct }))

  let right = block.choices.filter((choice) => choice.correct)
  // Choices with no right one are suggestions for a typed answer: the accept lines grade it.
  if (picks && (right.length > 0 || !block.accept.length)) {
    let correct = picks.length === right.length && picks.every((choice) => choice.correct)
    // The verdict already says right or wrong: drop a quiz explanation's own "Right." / "Not quite.".
    let explained = picks.map((choice) => choice.explanation.replace(VERDICT_LEAD, '')).filter(Boolean)
    let feedback = correct
      ? explained.join(' ') || block.explain || 'That’s it.'
      : picks.length && picks.every((choice) => choice.correct)
        ? `Right so far, but there’s more than ${picks.length === 1 ? 'that one' : 'those'}: name every right option.`
        : explained.join(' ') || block.hint || 'Not quite. Try again.'
    return { correct, picks: pickList, checks: [], feedback }
  }

  // Choices only: an answer that names none isn't graded as a guess.
  if (!block.accept.length) {
    return { correct: false, picks: [], checks, feedback: 'Pick one of the options: tap it, or type its letter.' }
  }
  let correct = accept.every((check) => check.passed) && rejected.length === 0
  let feedback = correct ? block.explain || 'That’s it.' : rejected[0]?.feedback || block.hint || 'Not quite. Try again.'
  return { correct, picks: pickList, checks, feedback }
}
