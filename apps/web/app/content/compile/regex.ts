// Prompt checks are author-written regexes that run on the server against
// learner input (app/progress/check.ts) and in learners' browsers. Instead
// of hunting for dangerous shapes, checks are limited to a small grammar
// that can't backtrack badly by construction (decision 018):
//
// - literal characters and `.`;
// - the escapes \b \B \w \W \d \D \s \S, and escaped symbols like \. or \(;
// - character classes [...] with literals, those escapes and simple ranges
//   (a-z), not empty and not nested;
// - `|`, plain groups (...) and non-capturing groups (?:...);
// - the anchors ^ and $;
// - the quantifier ?, at most MAX_OPTIONALS times.
//
// Anything else is rejected, including all repetition (*, +, {n,m}),
// lookarounds, named groups and backreferences. Without repetition the
// matcher's work per start position is bounded by the number of distinct
// paths through the pattern (each | adds one, each ? doubles its atom), so
// that is capped too (MAX_PATHS). The source is walked once, left to right,
// and the default for anything unrecognised is to reject.

/** Longest check pattern accepted. */
export const MAX_PATTERN_LENGTH = 200

/** Most `?` quantifiers in one pattern. */
export const MAX_OPTIONALS = 4

/** Most ways a pattern can match at one position (alternatives × optionals). */
export const MAX_PATHS = 64

/** Flags a check may use; `g` and `y` would make `.test()` stateful. */
const ALLOWED_FLAGS = /^[imsu]*$/

/** Escapes allowed outside and inside classes: character classes and assertions. */
const CLASS_ESCAPES = 'wWdDsS'
const ASSERTION_ESCAPES = 'bB'
/** Symbols that may be escaped to mean themselves. */
const ESCAPABLE = '\\^$.|?*+()[]{}/-'

const REPETITION = 'uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/'

/** A problem with the pattern, or null when it's fine. */
export function checkPattern(source: string, flags = ''): string | null {
  if (!source) return 'is empty'
  if (source.length > MAX_PATTERN_LENGTH) return `is ${source.length} characters long (max ${MAX_PATTERN_LENGTH})`
  if (!ALLOWED_FLAGS.test(flags)) return `uses flags "${flags}" (only i, m, s and u are allowed)`
  try {
    new RegExp(source, flags)
  } catch (error) {
    return `doesn't compile: ${(error as Error).message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, '')}`
  }
  return grammarProblem(source)
}

/** True when a stored pattern is one the build would accept (the server re-checks before running it). */
export function isSafePattern(source: string, flags = ''): boolean {
  return checkPattern(source, flags) === null
}

/**
 * One frame per open group (plus the whole pattern): the paths of finished
 * branches, of the current branch, and of the current branch before its last
 * atom (so a `?` after it can double just that atom).
 */
interface Frame {
  alternatives: number
  branch: number
  beforeAtom: number
  /** Paths through the last atom. */
  atomPaths: number
  /** The branch's last token can take a `?`. */
  quantifiable: boolean
}

/** Why the pattern is outside the check grammar, or null. Walks the source once. */
function grammarProblem(source: string): string | null {
  let stack: Frame[] = [frame()]
  let optionals = 0
  let top = () => stack[stack.length - 1]!
  let atom = (paths = 1) => {
    let f = top()
    f.beforeAtom = f.branch
    f.atomPaths = paths
    f.branch = cap(f.branch * paths)
    f.quantifiable = true
  }
  let assertion = () => {
    top().quantifiable = false
  }

  for (let i = 0; i < source.length; i++) {
    let ch = source[i]!
    switch (ch) {
      case '\\': {
        let next = source[i + 1] ?? ''
        i++
        if (ASSERTION_ESCAPES.includes(next)) assertion()
        else if (CLASS_ESCAPES.includes(next) || ESCAPABLE.includes(next)) atom()
        else return badEscape(next)
        break
      }
      case '[': {
        let end = classEnd(source, i)
        if (typeof end === 'string') return end
        i = end
        atom()
        break
      }
      case '(': {
        if (source[i + 1] === '?') {
          if (source[i + 2] !== ':') return 'uses a (?…) group other than (?:…); lookarounds and named groups aren’t allowed in checks'
          i += 2
        }
        stack.push(frame())
        break
      }
      case ')': {
        if (stack.length === 1) return 'has an unmatched )'
        let group = stack.pop()!
        atom(cap(group.alternatives + group.branch))
        break
      }
      case '|': {
        let f = top()
        f.alternatives = cap(f.alternatives + f.branch)
        f.branch = 1
        f.beforeAtom = 1
        f.quantifiable = false
        break
      }
      case '?': {
        let f = top()
        if (!f.quantifiable) return 'has a ? that doesn’t follow a character, class or group'
        if (++optionals > MAX_OPTIONALS) return `has more than ${MAX_OPTIONALS} optional parts (?); split it into separate checks`
        f.branch = cap(f.beforeAtom * (f.atomPaths + 1))
        f.quantifiable = false
        break
      }
      case '*':
      case '+':
      case '{':
      case '}':
        return REPETITION
      case ']':
        return 'has an unescaped ] outside a character class; write \\] for the character'
      case '^':
      case '$':
        assertion()
        break
      default:
        // `.` and every non-syntax character: one way to match.
        atom()
    }
  }
  if (stack.length !== 1) return 'has an unclosed ('
  let root = stack[0]!
  let paths = root.alternatives + root.branch
  if (paths > MAX_PATHS) {
    return `can match in more than ${MAX_PATHS} ways (alternatives × optional parts); split it into separate checks`
  }
  return null
}

function frame(): Frame {
  return { alternatives: 0, branch: 1, beforeAtom: 1, atomPaths: 1, quantifiable: false }
}

/** Path counts only need to know they passed MAX_PATHS. */
function cap(n: number): number {
  return Math.min(n, MAX_PATHS + 1)
}

function badEscape(next: string): string {
  if (/[1-9]/.test(next) || next === 'k') return 'uses a backreference (\\1 or \\k<name>); write the text out instead'
  if (!next) return 'ends with a lone \\'
  return `uses \\${next}, which isn’t allowed in checks; use \\b \\B \\w \\W \\d \\D \\s \\S or escape a symbol like \\.`
}

/**
 * Validates the class that opens at `i` and returns the index of its `]`,
 * or a problem. Items are literals, allowed escapes and simple ranges.
 */
function classEnd(source: string, i: number): number | string {
  i++
  if (source[i] === '^') i++
  if (source[i] === ']') return 'has an empty character class [] (or one starting with ]); write \\] for the character'
  // The previous item, when it was a single character that can start a range.
  let previous: string | null = null
  for (; i < source.length; i++) {
    let ch = source[i]!
    if (ch === ']') return i
    if (ch === '[') return 'has a [ inside a character class; nested classes aren’t allowed, write \\[ for the character'
    let item: string | null
    if (ch === '\\') {
      let next = source[++i] ?? ''
      if (CLASS_ESCAPES.includes(next)) item = null
      else if (ESCAPABLE.includes(next)) item = next
      else return badEscape(next)
    } else if (ch === '-' && previous !== null && source[i + 1] !== ']') {
      // A range: previous-next.
      let hiChar = source[i + 1]!
      let hi = hiChar === '\\' ? source[i + 2] ?? '' : hiChar
      if (hiChar === '[') return 'has a [ inside a character class; nested classes aren’t allowed, write \\[ for the character'
      if (hiChar === '\\' && !ESCAPABLE.includes(hi)) return 'has a character class range that doesn’t end in a single character, like a-z'
      if (hi < previous) return `has a backwards range ${previous}-${hi} in a character class`
      i += hiChar === '\\' ? 2 : 1
      previous = null
      continue
    } else {
      item = ch
    }
    previous = item
  }
  return 'has an unclosed character class ['
}
