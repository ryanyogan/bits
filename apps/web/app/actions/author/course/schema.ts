import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

/** POST /author/:course/publish and /rollback: which version goes live (v{n}). */
export const versionForm = f.object({
  version: f.field(
    s.defaulted(s.string(), '').transform((value) => {
      let n = Number(value)
      return value && Number.isInteger(n) && n > 0 ? n : undefined
    }),
  ),
})
