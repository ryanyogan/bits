// Caps on what authored content can award. The build rejects values outside
// them (app/content/compile/), and progress/check.ts clamps awards to them
// again, so stored content can never mint more than this.

/** Most xp a single :::prompt or :::quiz block may award. */
export const MAX_BLOCK_XP = 100

/** Most xp a whole lesson (frontmatter `xp`) may award. */
export const MAX_LESSON_XP = 500

/** `value` as a whole number in 0…max (NaN and negatives become 0). */
export function clampXp(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.floor(value), max)
}
