import { css } from 'remix/component'

import type { CourseSummary } from '../../../../content/types.ts'

type Tone = CourseSummary['tone']

/** Page-level `--tone` for the course colour (the hero stripe, breadcrumb, meta tag). */
export const toneStyles: Record<Tone, ReturnType<typeof css>> = {
  volt: css({ '--tone': 'var(--volt)' }),
  ion: css({ '--tone': 'var(--ion)' }),
  synapse: css({ '--tone': 'var(--synapse)' }),
}

export function toneAlpha(percent: number): string {
  return `color-mix(in srgb, var(--tone) ${percent}%, transparent)`
}
