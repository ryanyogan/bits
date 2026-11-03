// Per-course coach eval (decision 064): the labelled attempts a course's own
// coached `:::prompt` blocks imply. Pure, so it's unit-tested without a model.
//
// The labels come from what each line of a block means:
//   - `- reference` is the author's strong prompt: **pass**, on Claude's live
//     reply to it.
//   - `- draft` is the weak starting prompt the learner is asked to improve:
//     **fail**, on Claude's live reply to it.
//   - `- example T=… "…"` lines are canned replies, shown as the output a
//     good run gives (decision 019). In a coached block whose live runs
//     include the example's temperature they stand in for the reply to a
//     strong prompt, so each one is paired with the reference: **pass**.
//     An example at a temperature the block never runs live (the T=0 side of
//     a "run at 0 and 1.0" exercise) has no label, so it's skipped.
// Hand-written extras (course-cases.ts) are added per exercise.
import type { LessonContent, PromptBlock } from '../../app/actions/courses/lesson/content.ts'
import { exercisesOf } from '../../app/actions/courses/lesson/content.ts'

export interface CourseCase {
  name: string
  prompt: string
  /** A fixed reply; absent means "Claude's live reply to the prompt". */
  reply?: string
  /** The label: should this attempt pass? */
  pass: boolean
}

export interface CourseExercise {
  lesson: string
  order: number
  block: PromptBlock
  cases: CourseCase[]
}

/** A hand-written attempt for one exercise. `prompt` may name the block's own reference or draft. */
export interface ExtraCase {
  name: string
  prompt: 'reference' | 'draft' | { text: string }
  reply?: string
  pass: boolean
}

/** Extras keyed by course slug, then exercise id. */
export type CourseExtras = Record<string, Record<string, ExtraCase[]>>

/**
 * A reference may elide the material the draft already holds, e.g.
 * `<search_results>…the three results…</search_results>`. A tagged span whose
 * body contains "…" is filled from the same tag in the draft, so the
 * reference is graded as the full prompt a learner would send.
 */
export function expandReference(reference: string, draft: string | undefined): string {
  if (!draft) return reference
  return reference.replace(/<([a-z][\w-]*)>([\s\S]*?)<\/\1>/gi, (span, tag: string, body: string) => {
    if (!body.includes('…')) return span
    let full = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`).exec(draft)
    return full ? full[0] : span
  })
}

/** Lesson orders from `10-13`, `3`, or `1,4-5`. Undefined: every lesson. */
export function parseLessonRange(spec: string | undefined): Set<number> | undefined {
  if (!spec) return undefined
  let orders = new Set<number>()
  for (let part of spec.split(',')) {
    let match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part)
    if (!match) throw new Error(`Bad --lessons value: ${spec} (use 10-13, 3 or 1,4-5)`)
    let from = Number(match[1])
    let to = match[2] ? Number(match[2]) : from
    for (let n = Math.min(from, to); n <= Math.max(from, to); n++) orders.add(n)
  }
  return orders
}

const hundredths = (t: number) => Math.round(t * 100)

/** The labelled cases one coached block implies, plus its extras. */
export function casesFor(block: PromptBlock, extras: ExtraCase[] = [], liveTemperatures: readonly number[] = [100]): CourseCase[] {
  let cases: CourseCase[] = []
  let reference = block.reference ? expandReference(block.reference, block.draft) : undefined
  if (reference) cases.push({ name: 'reference', prompt: reference, pass: true })
  if (block.draft) cases.push({ name: 'draft', prompt: block.draft, pass: false })
  if (reference) {
    let runs = block.run ? block.run.temperatures.map(hundredths) : [...liveTemperatures]
    block.examples.forEach((example, i) => {
      let t = hundredths(example.temperature)
      if (!liveTemperatures.includes(t) || !runs.includes(t)) return
      cases.push({ name: `example ${i + 1} (reply to the reference)`, prompt: reference, reply: example.text, pass: true })
    })
  }
  for (let extra of extras) {
    let prompt = extra.prompt === 'reference' ? reference : extra.prompt === 'draft' ? block.draft : extra.prompt.text
    if (!prompt) throw new Error(`Extra "${extra.name}" for ${block.id} names a ${String(extra.prompt)} the block doesn't have`)
    cases.push({ name: extra.name, prompt, reply: extra.reply, pass: extra.pass })
  }
  return cases
}

/** Every coached exercise in a built course (optionally only some lessons), with its cases. */
export function courseExercises(
  lessons: Map<string, LessonContent>,
  options: { course: string; orders?: Set<number>; extras?: CourseExtras; liveTemperatures?: readonly number[] },
): CourseExercise[] {
  let extras = options.extras?.[options.course] ?? {}
  let known = new Set<string>()
  let out: CourseExercise[] = []
  let sorted = [...lessons].sort(([, a], [, b]) => a.order - b.order)
  for (let [lesson, content] of sorted) {
    for (let block of exercisesOf(content)) {
      known.add(block.id)
      if (!block.coach) continue
      if (options.orders && !options.orders.has(content.order)) continue
      out.push({ lesson, order: content.order, block, cases: casesFor(block, extras[block.id], options.liveTemperatures) })
    }
  }
  for (let id of Object.keys(extras)) {
    if (!known.has(id)) throw new Error(`Extras for ${options.course} name an exercise that isn't in the course: ${id}`)
  }
  return out
}
