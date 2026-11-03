// The deterministic layers of a prompt exercise's verdict (decision 064):
// prompt checks (`- check`), the run requirement (`- run`) and, on a live
// reply, the reply checks (`- expect`). Pure: /api/coach and the lesson save
// both call it, so a pass means the same thing in both places. The rubric
// (the judge) is layered on top by coach.ts.
import type { CoachVerdict, JournalRun, VerdictCriterion } from '@bits/db'
import { checkPasses } from '@bits/ui/prompt-composer'

import type { PromptBlock } from '../actions/courses/lesson/content.ts'
import { isSafePattern } from '../content/compile/regex.ts'
import { runReplyCheck } from './reply-checks.ts'

/** A journalled run as grading needs it. */
export interface GradedRun {
  prompt: string
  output: string
  /** The model ran (source `live` and finished): only then are reply checks and the rubric graded. */
  live: boolean
}

export interface DeterministicGrade {
  criteria: VerdictCriterion[]
  /** Every check, run requirement and (live) expect holds. */
  holds: boolean
  /**
   * pattern: no live reply, so the prompt checks decide (labelled as such).
   * reply: a live reply, decided by the deterministic checks alone.
   * judge: a coached block whose deterministic checks hold on a live reply;
   * the rubric decides, through the coach.
   */
  layer: 'pattern' | 'reply' | 'judge'
}

const hundredths = (t: number) => Math.round(t * 100)

function patternsMatch(patterns: { source: string; flags?: string }[], text: string): boolean {
  return patterns.every((pattern) => isSafePattern(pattern.source, pattern.flags)) && checkPasses({ label: '', patterns }, text, new Set())
}

/** Grades one run's deterministic layers. `ranAt`: temperatures (× 100) journalled for this exercise. */
export function gradeRun(block: PromptBlock, run: GradedRun, ranAt: ReadonlySet<number>): DeterministicGrade {
  let prompt = run.prompt.trim()
  let criteria: VerdictCriterion[] = []
  for (let check of block.checks) {
    criteria.push({ label: check.label, kind: 'check', met: Boolean(prompt) && patternsMatch(check.patterns, prompt) })
  }
  if (block.run) {
    let needed = block.run.temperatures.map(hundredths)
    criteria.push({ label: block.run.label, kind: 'run', met: needed.every((t) => ranAt.has(t)) })
  }
  for (let check of block.expects ?? []) {
    // A prompt-length check reads the prompt, so it holds offline too.
    if (!run.live && check.kind !== 'prompt-shorter-than') {
      criteria.push({ label: check.label, kind: 'expect', met: null })
      continue
    }
    let result = runReplyCheck(check, { reply: run.output, prompt, documents: block.documents })
    let criterion: VerdictCriterion = { label: check.label, kind: 'expect', met: result.met }
    if (result.note) criterion.note = result.note
    criteria.push(criterion)
  }
  for (let line of block.rubric ?? []) criteria.push({ label: line.label, kind: 'rubric', level: line.level, met: null })

  let holds = Boolean(prompt) && criteria.every((criterion) => criterion.kind === 'rubric' || criterion.met !== false)
  let layer: DeterministicGrade['layer'] = !run.live ? 'pattern' : block.coach && holds ? 'judge' : 'reply'
  return { criteria, holds, layer }
}

/**
 * Whether the run passes without the judge: true or false when the
 * deterministic layers decide, undefined when the rubric must be judged.
 */
export function passesWithoutJudge(grade: DeterministicGrade): boolean | undefined {
  return grade.layer === 'judge' ? undefined : grade.holds
}

/** The run counts as live only once the model's reply is journalled. */
export function isLiveRun(run: Pick<JournalRun, 'source' | 'model'>): boolean {
  return run.source === 'live' && run.model !== null
}

/** A verdict that graded a run (not a reveal, not a judge call in flight). */
export function isGraded(row: Pick<CoachVerdict, 'layer'>): boolean {
  return row.layer !== 'reveal' && row.layer !== 'pending'
}

/** One owner's journal for an exercise: misses, the first pass, and whether a reveal came before it. */
export function exerciseHistory(verdicts: CoachVerdict[], exerciseId: string) {
  let rows = verdicts.filter((row) => row.exercise_id === exerciseId)
  let firstPass = rows.find((row) => isGraded(row) && row.passed)
  let firstReveal = rows.find((row) => row.layer === 'reveal')
  return {
    misses: rows.filter((row) => isGraded(row) && !row.passed).length,
    passedAt: firstPass?.created_at,
    revealedAt: firstReveal?.created_at,
    /** A strong prompt was shown before the first pass (or with no pass yet). */
    revealedFirst: Boolean(firstReveal && (!firstPass || firstReveal.created_at <= firstPass.created_at)),
  }
}

/** Half the share, rounded down, when the strong prompt was shown before the pass (decision 064). */
export function exerciseXp(share: number, revealedFirst: boolean): number {
  return revealedFirst ? Math.floor(share / 2) : share
}

export interface JournalledExercise {
  passed: boolean
  /** The strong prompt was shown before the pass: it earns half. */
  revealed: boolean
  /** The prompt that passed (recorded with the save). */
  prompt: string
}

/**
 * Which of a lesson's exercises the journal says passed (the save, decision
 * 064): a passing verdict from /api/coach, or a journalled run whose
 * deterministic layers pass on their own (no judge needed). Never form fields.
 *
 * A saved-example run counts on its own only when `offline` (no model is
 * connected at all). With a model connected, a canned reply came from a run
 * limit or an outage, and only /api/coach can tell which: an outage's pass is
 * the coach's journalled `pattern` verdict; a limit's is never written.
 */
export function journalledExercises(
  blocks: PromptBlock[],
  runs: JournalRun[],
  verdicts: CoachVerdict[],
  options: { offline: boolean },
): Record<string, JournalledExercise> {
  let out: Record<string, JournalledExercise> = {}
  for (let block of blocks) {
    let own = runs.filter((run) => run.exercise_id === block.id)
    let ranAt = new Set(own.map((run) => run.temperature))
    let history = exerciseHistory(verdicts, block.id)
    let byVerdict = verdicts.find((row) => row.exercise_id === block.id && isGraded(row) && row.passed)
    let verdictRun = byVerdict && own.find((run) => run.id === byVerdict.attempt_id)
    // Oldest first, so the earliest pass decides whether a reveal came before it.
    let byRun = [...own]
      .sort((a, b) => a.created_at - b.created_at)
      .filter((run) => options.offline || isLiveRun(run))
      .find((run) => passesWithoutJudge(gradeRun(block, { prompt: run.prompt, output: run.output, live: isLiveRun(run) }, ranAt)) === true)
    let times = [history.passedAt, byRun?.created_at].filter((t): t is number => t !== undefined)
    let passedAt = times.length ? Math.min(...times) : undefined
    let revealed = history.revealedAt !== undefined && (passedAt === undefined || history.revealedAt <= passedAt)
    out[block.id] = {
      passed: passedAt !== undefined,
      revealed,
      prompt: (verdictRun ?? byRun)?.prompt ?? '',
    }
  }
  return out
}
