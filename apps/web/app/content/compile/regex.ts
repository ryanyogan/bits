// Prompt checks are author-written regexes that run on the server against
// learner input (app/progress/check.ts) and in learners' browsers, so the
// build only accepts patterns that can't backtrack catastrophically. The
// analyzer is deliberately conservative; learner input is capped at
// MAX_PROMPT_LENGTH (4,000 characters) as well. It rejects:
// - patterns over 200 characters, or with flags other than i, m, s and u;
// - nested quantifiers: a repeated group that itself repeats, like (a+)+;
// - repeated alternations whose branches can match the same text, like
//   (a|a)* or (\w|x)+ (only distinct plain words may be repeated);
// - backreferences (\1, \k<name>), which no linear-time engine supports;
// - more than two unbounded quantifiers (*, +, {n,}), since each one
//   multiplies the work on a failed match.

/** Longest check pattern accepted. */
export const MAX_PATTERN_LENGTH = 200

/** Most `*`, `+` or `{n,}` quantifiers in one pattern. */
export const MAX_UNBOUNDED_QUANTIFIERS = 2

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
  return unsafeRegex(source)
}

/** Why a (compiling) pattern could backtrack badly, or null when it can't. */
export function unsafeRegex(source: string): string | null {
  // One entry per open group: where it starts and whether it repeats inside.
  let stack: { start: number; repeats: boolean }[] = []
  let unbounded = 0
  for (let i = 0; i < source.length; i++) {
    let ch = source[i]!
    if (ch === '\\') {
      let next = source[i + 1] ?? ''
      if (/[1-9]/.test(next) || next === 'k') return 'uses a backreference (\\1 or \\k<name>); write the text out instead'
      i++
      continue
    }
    if (ch === '[') {
      i = classEnd(source, i)
      continue
    }
    if (ch === '(') {
      stack.push({ start: i, repeats: false })
      continue
    }
    let repeat = repeatAt(source, i)
    if (ch === ')') {
      let group = stack.pop()
      if (!group) continue
      let after = repeatAt(source, i + 1)
      if (after) {
        if (group.repeats) return 'has a quantified group that repeats a quantifier, like (a+)+, which can backtrack forever'
        if (after === 'unbounded' && !distinctLiterals(source.slice(group.start + 1, i))) {
          return 'repeats an alternation whose branches can match the same text, like (a|a)*; repeat only distinct plain words'
        }
      }
      // A group that repeats (inside or as a whole) makes its parent repeat too.
      if ((group.repeats || after) && stack.length) stack[stack.length - 1]!.repeats = true
      continue
    }
    if (repeat) {
      if (stack.length) stack[stack.length - 1]!.repeats = true
      if (repeat === 'unbounded' && ++unbounded > MAX_UNBOUNDED_QUANTIFIERS) return tooManyUnbounded
    }
  }
  return null
}

const tooManyUnbounded = `has more than ${MAX_UNBOUNDED_QUANTIFIERS} unbounded quantifiers (*, + or {n,}), which can be slow on long prompts`

/** Kept for the build tests: true for `(a+)+`-shaped patterns. */
export function hasNestedQuantifier(source: string): boolean {
  return unsafeRegex(source)?.includes('repeats a quantifier') ?? false
}

/**
 * A quantifier at `i` that can repeat: `*`, `+` and `{n,}` are unbounded,
 * `{n,m}` and `{n}` bounded. `?` repeats nothing, so it isn't one.
 */
function repeatAt(source: string, i: number): 'unbounded' | 'bounded' | null {
  let ch = source[i]
  if (ch === '*' || ch === '+') return 'unbounded'
  if (ch !== '{') return null
  let match = /^\{(\d+)(,(\d*))?\}/.exec(source.slice(i))
  if (!match) return null
  if (match[2] && !match[3]) return 'unbounded'
  let most = Number(match[3] ?? match[1])
  return most > 1 ? 'bounded' : null
}

/** Index of the `]` closing the class that opens at `i`. */
function classEnd(source: string, i: number): number {
  i++
  if (source[i] === ']') i++
  while (i < source.length && source[i] !== ']') {
    if (source[i] === '\\') i++
    i++
  }
  return i
}

/**
 * True when a group body (without its parens) has no top-level alternation
 * (its inner quantifiers are checked as nesting), or is an alternation of
 * plain words that all start differently, so repeating it can only match
 * one way: `(cat|dog)*`.
 */
function distinctLiterals(body: string): boolean {
  body = body.replace(/^\?(?::|<[A-Za-z_$][\w$]*>)/, '')
  let branches = splitTopLevel(body)
  if (branches.length === 1) return true
  if (!branches.every((branch) => /^(?:[\w \-'",:;!@#%&=<>~`/]|\\[^\w])+$/.test(branch))) return false
  let firsts = branches.map((branch) => (branch[0] === '\\' ? branch[1] : branch[0])!.toLowerCase())
  return new Set(firsts).size === firsts.length
}

/** A group body split at its top-level `|` (not inside a nested group or class). */
function splitTopLevel(body: string): string[] {
  let branches: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < body.length; i++) {
    let ch = body[i]
    if (ch === '\\') i++
    else if (ch === '[') i = classEnd(body, i)
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '|' && depth === 0) {
      branches.push(body.slice(from, i))
      from = i + 1
    }
  }
  branches.push(body.slice(from))
  return branches
}
