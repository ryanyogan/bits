import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'

import { MAX_PROMPT_LENGTH } from '../../progress/check.ts'

const slug = s.string().pipe(checks.minLength(1), checks.maxLength(120))

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
})
