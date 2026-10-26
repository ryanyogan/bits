// Prompt checks are regexes that run on the server against learner input
// (app/progress/check.ts), so the build rejects ones that don't compile and
// ones with nested quantifiers like `(a+)+`, the classic catastrophic
// backtracking shape. Prompts are capped at 4,000 characters as well.

/** Longest check pattern accepted. */
export const MAX_PATTERN_LENGTH = 200

/** Flags a check may use; `g` and `y` would make `.test()` stateful. */
const ALLOWED_FLAGS = /^[imsu]*$/

/** A problem with the pattern, or null when it's fine. */
export function checkPattern(source: string, flags: string): string | null {
  if (!source) return 'is empty'
  if (source.length > MAX_PATTERN_LENGTH) return `is ${source.length} characters long (max ${MAX_PATTERN_LENGTH})`
  if (!ALLOWED_FLAGS.test(flags)) return `uses flags "${flags}" (only i, m, s and u are allowed)`
  try {
    new RegExp(source, flags)
  } catch (error) {
    return `doesn't compile: ${(error as Error).message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, '')}`
  }
  if (hasNestedQuantifier(source)) return 'has a quantified group that repeats a quantifier, like (a+)+, which can backtrack forever'
  return null
}

/**
 * True when a group containing a quantifier is itself quantified: `(a+)+`,
 * `(\w*)*`, `(?:x+){2,}`. Escapes and character classes are skipped.
 */
export function hasNestedQuantifier(source: string): boolean {
  // One entry per open group: whether a quantifier appeared inside it.
  let stack: boolean[] = []
  let lastGroupHadQuantifier = false
  for (let i = 0; i < source.length; i++) {
    let ch = source[i]!
    let closedGroup = false
    if (ch === '\\') {
      i++
    } else if (ch === '[') {
      // Skip the class body.
      i++
      while (i < source.length && source[i] !== ']') {
        if (source[i] === '\\') i++
        i++
      }
    } else if (ch === '(') {
      stack.push(false)
    } else if (ch === ')') {
      lastGroupHadQuantifier = stack.pop() ?? false
      closedGroup = true
      // A quantified inner group makes the outer one repeat too.
      if (lastGroupHadQuantifier && stack.length) stack[stack.length - 1] = true
    } else if (isRepeatAt(source, i)) {
      if (stack.length) stack[stack.length - 1] = true
    }
    if (closedGroup && lastGroupHadQuantifier && isRepeatAt(source, i + 1)) return true
  }
  return false
}

/** `*`, `+` or a `{n,m}` range: a quantifier that can repeat more than once. (`?` can't.) */
function isRepeatAt(source: string, i: number): boolean {
  let ch = source[i]
  if (ch === '*' || ch === '+') return true
  return ch === '{' && /^\{\d+,\d*\}/.test(source.slice(i))
}
