// Maps compiled blocks onto the shared island props (PromptComposer,
// TerminalLog prompt mode, CodeEditor). Plain data only: these cross into
// islands.
import type { CodeFile } from '@bits/ui/code-editor'
import type { PromptCheck, RunEndpoint, SubmitFields, TemperatureOption } from '@bits/ui/prompt-composer'
import type { RewardNext } from '@bits/ui/reward-toast'

import { routes } from '../../../../routes.ts'
import type { CodeBlock, PromptBlock } from '../content.ts'
import type { LessonView } from '../lesson-view.ts'

export function temperatureLabel(t: number): string {
  return t === 0 ? '0' : t.toFixed(1)
}

/** Field names of the lesson's "complete" form (read by app/progress/check.ts). */
export const fieldNames = {
  prompt: (exerciseId: string) => `prompt.${exerciseId}`,
  quiz: (quizId: string) => `quiz.${quizId}`,
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
  reward: { xp: number; message: string; next?: RewardNext }
  submit?: SubmitFields
  run?: RunEndpoint
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
  let next: RewardNext = view.next
    ? { href: view.href.lesson(view.next.slug), label: block.success.nextLabel ?? `Next: ${view.next.title} →` }
    : { href: view.href.back, label: 'Back to the course →' }
  return {
    // Keyed by course + lesson (+ exercise), so every mode shares the draft.
    id: `${view.key}/${block.id}`,
    task: block.task,
    placeholder: block.placeholder,
    defaultDraft: block.draft,
    checks,
    temperatures: block.temperatures.map((t) => ({ value: hundredths(t), label: temperatureLabel(t) })),
    examples,
    reward: { xp: block.xp, message: block.success.message, next },
    submit: view.completeForm
      ? { form: view.completeForm.id, prompt: fieldNames.prompt(block.id) }
      : undefined,
    // Runs go through /api/run (live or canned, journalled); the draft preview runs canned in the browser.
    run: view.completeForm
      ? { action: routes.api.run.href(), fields: { course: view.course.slug, lesson: view.lesson.slug, exercise: block.id } }
      : undefined,
  }
}

export function codeEditorProps(block: CodeBlock) {
  let first = block.files[0]!
  let files: CodeFile[] = block.files.map((file) => ({
    name: file.file,
    badge: file.badge,
    badgeTone: file.badge === '#' ? 'muted' : 'ion',
    language: file.language,
    lines: file.lines,
  }))
  return { files, highlight: first.highlight, focusLine: first.focusLine, typeMode: first.typeMode }
}
