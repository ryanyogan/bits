import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'

import { MAX_PROMPT_LENGTH } from '../../progress/check.ts'

const slug = s.string().pipe(checks.minLength(1), checks.maxLength(120))

/**
 * POST /api/ask: course, lesson and ask ids. The answer itself is
 * `answer.<ask>` (read separately).
 */
export const askForm = f.object({
  course: f.field(slug),
  lesson: f.field(slug),
  ask: f.field(slug),
})

/** POST /api/run: what the PromptComposer sends (as FormData). */
export const runForm = f.object({
  course: f.field(slug),
  lesson: f.field(slug),
  exercise: f.field(slug),
  prompt: f.field(
    s
      .string()
      .transform((value) => value.trim())
      .pipe(checks.minLength(1), checks.maxLength(MAX_PROMPT_LENGTH)),
  ),
  /** T × 100, one of the exercise's offered temperatures. */
  temperature: f.field(coerce.number().pipe(checks.min(0), checks.max(100))),
  /** The landing's composer (decision 074): tighter live caps. Anything else is a lesson run. */
  from: f.field(s.optional(s.literal('landing'))),
})

/**
 * POST /api/coach (decision 064): the exercise, then either `attempt` (a
 * journalled run id from X-Run-Id, to grade) or `reveal=1` (show the strong
 * prompt).
 */
export const coachForm = f.object({
  course: f.field(slug),
  lesson: f.field(slug),
  exercise: f.field(slug),
  attempt: f.field(s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(64)))),
  reveal: f.field(s.optional(s.literal('1'))),
})
