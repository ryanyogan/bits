import { css } from 'remix/component'

/** The three accent colours a course, track or chart can wear. */
export type Tone = 'volt' | 'ion' | 'synapse'

/** Sets `--tone` (and `--tone-soft` for text on tints) for children to read. */
export const toneVars: Record<Tone, ReturnType<typeof css>> = {
  volt: css({ '--tone': 'var(--volt)', '--tone-soft': 'var(--volt-soft)' }),
  ion: css({ '--tone': 'var(--ion)', '--tone-soft': 'var(--ion)' }),
  synapse: css({ '--tone': 'var(--synapse)', '--tone-soft': 'var(--synapse-soft)' }),
}

/** `--tone` at an alpha, e.g. `toneAlpha(45)` for the 0.45 cover dots. */
export function toneAlpha(percent: number): string {
  return `color-mix(in srgb, var(--tone) ${percent}%, transparent)`
}
