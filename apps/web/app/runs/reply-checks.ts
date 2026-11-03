// `- expect` reply checks (decision 064): deterministic, server-side, no
// model call. They run on a live reply only (grading a canned example would
// fake a result) and resist prompt injection: a reply either parses as JSON
// or it doesn't. Pure, so the coach, the save and the tests share it.
import type { ReplyCheck } from '../actions/courses/lesson/content.ts'
import { isSafePattern } from '../content/compile/regex.ts'

export interface ReplyCheckResult {
  met: boolean
  /** Why it missed, in words the learner can act on (never the pattern). */
  note?: string
}

/** Words, as a reader counts them. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

/** Sentences: runs ending in . ! or ? (or the end of the text). */
export function countSentences(text: string): number {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\p{N}]/u.test(part)).length
}

/** Lowercase, single-spaced, quotes and punctuation folded: how quotes are compared. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    // Keep an apostrophe only inside a word ("don't"), never as a quote mark.
    .replace(/(?<![\p{L}\p{N}])'+|'+(?![\p{L}\p{N}])/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A JSON value in the reply: the whole reply, or one fenced ```json block. */
export function replyJson(reply: string): { ok: true; value: unknown } | { ok: false } {
  let text = reply.trim()
  let fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(text)
  if (fenced) text = fenced[1]!.trim()
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

/** Shortest run of words that counts as a verbatim quote. */
export const QUOTE_WORDS = 8

/** The reply contains a run of `QUOTE_WORDS` words from `source`, in order. */
export function quotesFrom(reply: string, source: string, words = QUOTE_WORDS): boolean {
  let doc = normalizeText(source).split(' ')
  let said = ` ${normalizeText(reply)} `
  for (let i = 0; i + words <= doc.length; i++) {
    if (said.includes(` ${doc.slice(i, i + words).join(' ')} `)) return true
  }
  return false
}

export function runReplyCheck(
  check: ReplyCheck,
  input: { reply: string; prompt: string; documents?: Record<string, string> },
): ReplyCheckResult {
  let reply = input.reply.trim()
  switch (check.kind) {
    case 'json': {
      let parsed = replyJson(reply)
      if (!parsed.ok) return { met: false, note: 'The reply isn’t valid JSON on its own.' }
      let value = parsed.value
      if (check.keys?.length || check.types) {
        if (typeOf(value) !== 'object') return { met: false, note: 'The reply is JSON, but not an object.' }
        let object = value as Record<string, unknown>
        let missing = (check.keys ?? []).filter((key) => !(key in object))
        if (missing.length) return { met: false, note: `The JSON has no ${missing.map((key) => `"${key}"`).join(', ')}.` }
        for (let [key, type] of Object.entries(check.types ?? {})) {
          if (typeOf(object[key]) !== type) return { met: false, note: `"${key}" should be a ${type}.` }
        }
      }
      return { met: true }
    }
    case 'words': {
      let n = countWords(reply)
      return n <= check.max ? { met: true } : { met: false, note: `The reply has ${n} words (${check.max} at most).` }
    }
    case 'sentences': {
      let n = countSentences(reply)
      return n <= check.max
        ? { met: true }
        : { met: false, note: `The reply has ${n} sentences (${check.max} at most).` }
    }
    case 'one-word': {
      let n = countWords(reply)
      return n === 1 ? { met: true } : { met: false, note: `The reply has ${n} words, not one.` }
    }
    case 'oneof': {
      let said = normalizeText(reply)
      let hit = check.options.some((option) => normalizeText(option) === said)
      return hit ? { met: true } : { met: false, note: `The reply should be exactly one of: ${check.options.join(', ')}.` }
    }
    case 'tag': {
      let name = check.name.replace(/[^\w-]/g, '')
      let tagged = new RegExp(`<${name}>[\\s\\S]*?\\S[\\s\\S]*?</${name}>`, 'i').test(reply)
      return tagged ? { met: true } : { met: false, note: `The reply has no <${name}>…</${name}> section.` }
    }
    case 'cites': {
      let cited = [...reply.matchAll(/\[(\d{1,3})\]/g)].map((match) => Number(match[1]))
      if (!cited.length) return { met: false, note: 'The reply cites no passage, like [1].' }
      let bad = cited.filter((n) => n < check.min || n > check.max)
      return bad.length
        ? { met: false, note: `The reply cites [${bad[0]}], but only [${check.min}]–[${check.max}] exist.` }
        : { met: true }
    }
    case 'quotes': {
      let source = input.documents?.[check.document]
      if (!source) return { met: false }
      return quotesFrom(reply, source)
        ? { met: true }
        : { met: false, note: `The reply doesn’t quote the document word for word (${QUOTE_WORDS} words in a row).` }
    }
    case 'match': {
      let met = check.patterns.every(
        (pattern) => isSafePattern(pattern.source, pattern.flags) && new RegExp(pattern.source, pattern.flags).test(reply),
      )
      return { met }
    }
    case 'prompt-shorter-than': {
      let n = input.prompt.trim().length
      return n < check.max ? { met: true } : { met: false, note: `The prompt is ${n} characters (under ${check.max} to pass).` }
    }
  }
}
