import * as s from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'

const versionNumber = coerce.number().refine((value) => Number.isInteger(value) && value > 0, 'Pick a version.')

/** POST /author/:course/publish: which build goes live (v{n}); the latest build when absent. */
export const publishForm = f.object({
  version: f.field(s.optional(versionNumber)),
})

/** POST /author/:course/rollback: the older version to make live again (v{n}). */
export const rollbackForm = f.object({
  version: f.field(versionNumber),
})
