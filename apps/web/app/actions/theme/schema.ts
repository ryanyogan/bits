import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

/** POST /theme: the footer's theme switch (decision 062). */
export const themeForm = f.object({
  theme: f.field(s.enum_(['system', 'dark', 'light'] as const)),
})
