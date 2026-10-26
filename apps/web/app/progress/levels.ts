// Levels are defined in code (handoff: badges and levels are config, not
// rows): each starts at a neurons total.

const LEVELS: { at: number; name: string }[] = [
  { at: 0, name: 'Curious' },
  { at: 50, name: 'First words' },
  { at: 150, name: 'Token counter' },
  { at: 300, name: 'Probability reader' },
  { at: 500, name: 'Temperature tweaker' },
  { at: 750, name: 'Prompt apprentice' },
  { at: 1000, name: 'Prompt wrangler' },
  { at: 1500, name: 'Context packer' },
  { at: 2100, name: 'Tool caller' },
  { at: 2800, name: 'Loop builder' },
  { at: 3600, name: 'Agent wrangler' },
]

export interface Level {
  level: number
  name: string
  /** Progress to the next level, 0–100 (100 at the top level). */
  pct: number
  /** Neurons to the next level (0 at the top level). */
  toNext: number
}

export function levelFor(neurons: number): Level {
  let index = LEVELS.findLastIndex((level) => neurons >= level.at)
  let current = LEVELS[Math.max(0, index)]!
  let next = LEVELS[index + 1]
  if (!next) return { level: LEVELS.length, name: current.name, pct: 100, toNext: 0 }
  let span = next.at - current.at
  return {
    level: index + 1,
    name: current.name,
    pct: Math.floor(((neurons - current.at) / span) * 100),
    toNext: next.at - neurons,
  }
}
