// Maps compiled blocks onto the shared island props (PromptComposer,
// TerminalLog prompt mode, CodeEditor). Plain data only: these cross into
// islands.
import type { CodeFile } from '@bits/ui/code-editor'
import type { AskEndpoint } from '@bits/ui/lib/ask-client'
import type { DraftPersist } from '@bits/ui/lib/drafts'
import type { PromptCheck, RunEndpoint, SubmitFields, TemperatureOption } from '@bits/ui/prompt-composer'
import type { TerminalPart } from '@bits/ui/terminal'

import { draftKey } from '../../../../progress/draft-keys.ts'
import { routes } from '../../../../routes.ts'
import type { AskBlock, CodeBlock, PromptBlock } from '../content.ts'
import type { LessonView } from '../lesson-view.ts'

export function temperatureLabel(t: number): string {
  return t === 0 ? '0' : t.toFixed(1)
}

/** Field names of the lesson's "complete" form (read by app/progress/check.ts). */
export const fieldNames = {
  prompt: (exerciseId: string) => `prompt.${exerciseId}`,
  /** An ask's answer, posted to /api/ask (never read by the save: the journal says which were right). */
  ask: (askId: string) => `answer.${askId}`,
}

/** Temperatures travel as T × 100 so they compare exactly. */
const hundredths = (t: number) => Math.round(t * 100)

export interface ExerciseProps {
  id: string
  task: string
  placeholder?: string
  defaultDraft?: string
  checks: PromptCheck[]
  temperatures: TemperatureOption[]
  examples: Record<string, string[]>
  reward: { xp: number; message: string; note?: string }
  /** The lesson is saved as complete: the exercise opens passed. */
  passed: boolean
  submit?: SubmitFields
  run?: RunEndpoint
  persist: DraftPersist
}

/**
 * How an island keeps one of the lesson's drafts (decision 029): locally
 * under `localId` (unique across lessons), and on the server under `key`
 * when signed in.
 */
export function draftPersist(view: LessonView, key: string, localId = `${view.key}/${key}`): DraftPersist {
  let persist: DraftPersist = { id: localId, key }
  let saved = view.drafts[key]
  if (saved) persist.saved = saved
  if (view.draftSync) persist.sync = view.draftSync
  return persist
}

/** The exercise's checks, as the composer runs them and the server re-runs them. */
export function promptChecks(block: PromptBlock): PromptCheck[] {
  let checks: PromptCheck[] = block.checks.map((check) => ({ label: check.label, patterns: check.patterns }))
  if (block.run) checks.push({ label: block.run.label, ranAt: block.run.temperatures.map(hundredths) })
  return checks
}

/** Temperatures (× 100) the composer offers for this exercise. */
export function offeredTemperatures(block: PromptBlock): number[] {
  return block.temperatures.map(hundredths)
}

export function exerciseProps(view: LessonView, block: PromptBlock): ExerciseProps {
  let checks = promptChecks(block)
  let examples: Record<string, string[]> = {}
  for (let example of block.examples) (examples[String(hundredths(example.temperature))] ??= []).push(example.text)
  // The reward celebrates; it never navigates. The lesson has one
  // save-and-continue action, its footer key (decision 067): a link here
  // skipped the save, and sat above blocks not yet read.
  let note = view.lesson.state === 'done'
    ? undefined
    : view.completeForm
      ? 'Saved when you complete the lesson, at the end of the page.'
      : undefined
  // Keyed by course + lesson (+ exercise), so every mode shares the draft.
  let id = `${view.key}/${block.id}`
  return {
    id,
    persist: draftPersist(view, draftKey.prompt(block.id), id),
    task: block.task,
    placeholder: block.placeholder,
    defaultDraft: block.draft,
    checks,
    temperatures: block.temperatures.map((t) => ({ value: hundredths(t), label: temperatureLabel(t) })),
    examples,
    reward: { xp: block.xp, message: block.success.message, note },
    passed: view.lesson.state === 'done',
    submit: view.completeForm
      ? { form: view.completeForm.id, prompt: fieldNames.prompt(block.id) }
      : undefined,
    // Runs go through /api/run (live or canned, journalled); the draft preview runs canned in the browser.
    run: view.completeForm
      ? { action: routes.api.run.href(), fields: { course: view.course.slug, lesson: view.lesson.slug, exercise: block.id } }
      : undefined,
  }
}

/**
 * What the browser gets of an ask (decision 052): the question, placeholder
 * and option labels, never its patterns, right answers or explanations.
 * Graded through /api/ask; absent in the draft preview (nothing to grade
 * against). `passed` and `initial` come from the session (an earlier right
 * answer, a verdict flashed back to a native form).
 */
export function askProps(view: LessonView, block: AskBlock) {
  let endpoint: AskEndpoint | undefined = view.completeForm
    ? {
        action: routes.api.ask.href(),
        fields: {
          course: view.course.slug,
          lesson: view.lesson.slug,
          ask: block.id,
        },
        answerField: fieldNames.ask(block.id),
      }
    : undefined
  let initial = view.asks.verdict?.ask === block.id ? view.asks.verdict.verdict : undefined
  return {
    id: block.id,
    placeholder: block.placeholder,
    choices: block.choices.map((choice) => ({ key: choice.key, label: choice.label })),
    multiple: block.multiple,
    xp: block.xp,
    endpoint,
    passed: view.asks.passed.includes(block.id),
    initial,
  }
}

/** A run's output lines, with its summary (if any) as a last muted line. */
export function runLines(run: { lines: TerminalPart[][]; summary?: string }): TerminalPart[][] {
  return run.summary ? [...run.lines, [['muted', run.summary]]] : run.lines
}

export function codeEditorProps(view: LessonView, block: CodeBlock) {
  let first = block.files[0]!
  let files: CodeFile[] = block.files.map((file) => ({
    name: file.file,
    badge: file.badge,
    badgeTone: file.badge === '#' ? 'muted' : 'ion',
    language: file.language,
    lines: file.lines,
  }))
  return {
    files,
    // The editor's footer reads "lines X–Y: <label>"; without an authored
    // label it says what the range is rather than repeating it.
    highlight: first.highlight && { ...first.highlight, label: first.highlight.label ?? 'highlighted' },
    focusLine: first.focusLine,
    typeMode: first.typeMode,
    // What was retyped is a draft too, shared by Read and Terminal mode.
    persist: first.typeMode && !view.draft ? draftPersist(view, draftKey.code(first.file)) : undefined,
  }
}
