// What the coach says (decision 064), as pure functions: the hint after a
// miss, the line on a pass, the "Stronger hint", and why a reply wasn't
// graded. Each is chosen from the verdict's own criteria, so the words
// never disagree with the ✓ and ✗ beside them (QA, 2026-11-02).
import type { VerdictCriterion } from '@bits/db'

import type { PromptBlock } from '../actions/courses/lesson/content.ts'

/** The first criterion that decides and isn't met: the one a hint is about. */
export function firstUnmet(criteria: VerdictCriterion[]): VerdictCriterion | undefined {
  return criteria.find((criterion) => criterion.met === false && criterion.level !== 'should')
}

function tiedHint(block: PromptBlock, label: string): string | undefined {
  return block.hintsFor?.find((hint) => hint.for === label)?.text
}

/** The author's general hint for the n-th miss (1-based), general first. */
export function ladderHint(block: PromptBlock, misses: number): string | undefined {
  let hints = block.hints ?? []
  return hints.length ? hints[Math.min(Math.max(misses, 1) - 1, hints.length - 1)] : undefined
}

/** A plain hint from the label, when the author wrote none for it. */
function labelHint(criterion: VerdictCriterion): string {
  switch (criterion.kind) {
    case 'check':
      return `Your prompt doesn’t do this yet: “${criterion.label}”.`
    case 'run':
      return `Not yet: “${criterion.label}”. Run it at each temperature it names.`
    case 'expect':
      return `The reply doesn’t do this yet: “${criterion.label}”. What in your prompt would get Claude there?`
    case 'rubric':
      return `Not yet: “${criterion.label}”.`
  }
}

/**
 * The hint after a miss, about the first criterion not met:
 * 1. that check's own note ("The reply has 3 sentences (2 at most).");
 * 2. on a rubric miss, the judge's hint (already filtered by safeJudgeHint),
 *    which the judge is told to write about the first unmet line;
 * 3. the author's hint for that criterion (`- hint for="label"`);
 * 4. on a rubric miss, the author's general hint for this attempt;
 * 5. else a sentence naming the criterion.
 * General hints never answer a deterministic miss: they aren't tied to a
 * criterion, so they could be about something that already passed.
 */
export function missHint(block: PromptBlock, criteria: VerdictCriterion[], misses: number, judged?: string): string {
  let first = firstUnmet(criteria)
  if (!first) return judged ?? ladderHint(block, misses) ?? 'Not yet. Look at the ✗ lines.'
  if (first.note) return first.note
  if (first.kind === 'rubric' && judged) return judged
  let tied = tiedHint(block, first.label)
  if (tied) return tied
  if (first.kind === 'rubric') {
    let ladder = ladderHint(block, misses)
    if (ladder) return ladder
  }
  return labelHint(first)
}

/**
 * The coach's line on a pass: generated from the verdict, never the judge's
 * free text (it could question a line that is met). Empty unless a
 * nice-to-have is still missing; the success message is the reward's.
 */
export function passNote(criteria: VerdictCriterion[]): string {
  let missing = criteria.filter((criterion) => criterion.met === false && criterion.level === 'should')
  if (!missing.length) return ''
  let [first] = missing
  return missing.length === 1
    ? `One nice-to-have to try next time: “${first!.label}”.`
    : `${missing.length} nice-to-haves to try next time, starting with “${first!.label}”.`
}

/**
 * "Stronger hint" (from the coachLimits.strongerAfter-th miss): a hint the
 * learner hasn't been shown, about what failed. The author's hint for the
 * first unmet criterion first; then, on a rubric miss, the general ladder
 * from this attempt on. Undefined when every such hint was already shown,
 * so the button hides instead of repeating one.
 */
export function strongerHint(
  block: PromptBlock,
  criteria: VerdictCriterion[],
  misses: number,
  strongerAfter: number,
  shown: ReadonlySet<string>,
): string | undefined {
  let first = firstUnmet(criteria)
  let candidates: string[] = []
  let tied = first && tiedHint(block, first.label)
  if (tied) candidates.push(tied)
  if (!first || first.kind === 'rubric') {
    let hints = block.hints ?? []
    let start = Math.min(Math.max(misses - strongerAfter + 1, 0), hints.length - 1)
    candidates.push(...hints.slice(Math.max(start, 0)))
  }
  return candidates.find((hint) => !shown.has(hint))
}

// ---- Replies that weren't live ------------------------------------------------

/** Why a run's reply was a saved example instead of Claude's. */
export type NotLive =
  /** No model is connected (local dev, tests, a preview): grade the prompt, labelled. */
  | { kind: 'unconfigured' }
  /** A model is connected but the call failed: a real outage, graded by pattern so no one is stuck. */
  | { kind: 'outage' }
  /** Over a run limit: no grade and no pass. `resetsAt` is when a live run is free again (at the latest). */
  | { kind: 'limit'; limit: 'hour' | 'day' | 'ip' | 'budget'; cap: number; signedIn: boolean; resetsAt: number }
  /** The temperature never runs live (only T=1.0 does): not graded; run at a live one. */
  | { kind: 'example'; live: string[] }

export const PATTERN_NOTES = {
  unconfigured: 'No model is connected here, so this reply is a saved example. Your prompt was checked by pattern; the reply wasn’t judged.',
  outage: 'Claude couldn’t be reached, so this reply is a saved example. Your prompt was checked by pattern; the reply wasn’t judged.',
} as const

const runs = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

function wait(ms: number): string {
  let minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes <= 60) return `${minutes} min`
  let hours = Math.ceil(minutes / 60)
  return `${hours} h`
}

/** What a reply that couldn't be graded says: which limit, and when it frees up. */
export function notGradedMessage(why: Extract<NotLive, { kind: 'limit' | 'example' }>, now: number): string {
  if (why.kind === 'example') {
    let live = why.live.length ? `T=${why.live.join(' or T=')}` : 'a live temperature'
    return `This temperature shows a saved example (only ${live} runs live), so the reply isn’t graded. Run it at ${live} for the coach to check it.`
  }
  let left = wait(why.resetsAt - now)
  let base = 'so this reply is a saved example and isn’t graded.'
  switch (why.limit) {
    case 'hour':
      return why.signedIn
        ? `You’ve used this hour’s ${runs(why.cap, 'live run')}, ${base} A live run frees up within ${left}.`
        : `You’ve used this hour’s ${runs(why.cap, 'live run')} for signed-out learners, ${base} A live run frees up within ${left}, or sign in for more.`
    case 'ip':
      return `This network has used its ${runs(why.cap, 'signed-out live run')} this hour, ${base} A live run frees up within ${left}, or sign in for more.`
    case 'day':
      return `You’ve used today’s ${runs(why.cap, 'run')}, ${base} A live run frees up within ${left}.`
    case 'budget':
      return `Today’s live runs for everyone are used up, ${base} They reset at 00:00 UTC, in ${left}.`
  }
}
