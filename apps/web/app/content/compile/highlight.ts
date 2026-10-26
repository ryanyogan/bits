// Build-time syntax highlighting for `:::code` blocks, so the browser ships
// no highlighter. A small lexer, not Shiki: it knows comments, strings,
// numbers, keywords, types and calls, which is all the CodeEditor colours.
// Languages it doesn't know come out as plain text.
import type { CodeSegment, SyntaxKind } from '@bits/ui/code-editor'

interface Language {
  /** Badge before the file name. */
  badge: string
  /** Name in the editor's status bar. */
  name: string
  lineComment?: string
  keywords: Set<string>
  /** Capitalised identifiers are types (TS, Python classes). */
  capitalTypes: boolean
  /** Bare words that are types (`string`, `int`). */
  types: Set<string>
}

const words = (text: string) => new Set(text.split(/\s+/).filter(Boolean))

const jsKeywords = words(`
  import from export default const let var function async await return if else while for do of in new
  class extends type interface enum as satisfies typeof instanceof keyof readonly declare namespace
  true false null undefined this super throw try catch finally break continue switch case yield void delete
`)

const typescript: Language = {
  badge: 'TS',
  name: 'TypeScript',
  lineComment: '//',
  keywords: jsKeywords,
  capitalTypes: true,
  types: words('string number boolean unknown any never object bigint symbol'),
}

const javascript: Language = { ...typescript, badge: 'JS', name: 'JavaScript', types: new Set() }

const python: Language = {
  badge: 'PY',
  name: 'Python',
  lineComment: '#',
  keywords: words(`
    import from as def return if elif else while for in not and or is class with try except finally raise
    lambda yield async await pass break continue global nonlocal True False None
  `),
  capitalTypes: true,
  types: words('str int float bool list dict tuple set bytes'),
}

const shell: Language = {
  badge: '$',
  name: 'Shell',
  lineComment: '#',
  keywords: words('if then else elif fi for while do done case esac in function export return local'),
  capitalTypes: false,
  types: new Set(),
}

const properties: Language = { badge: '#', name: 'Properties', lineComment: '#', keywords: new Set(), capitalTypes: false, types: new Set() }

const json: Language = { badge: '{}', name: 'JSON', keywords: words('true false null'), capitalTypes: false, types: new Set() }

const plain: Language = { badge: '¶', name: 'Plain text', keywords: new Set(), capitalTypes: false, types: new Set() }

const languages: Record<string, Language> = {
  ts: typescript,
  tsx: typescript,
  typescript,
  js: javascript,
  jsx: javascript,
  mjs: javascript,
  javascript,
  py: python,
  python,
  sh: shell,
  bash: shell,
  shell,
  zsh: shell,
  env: properties,
  properties,
  ini: properties,
  dotenv: properties,
  json,
  text: plain,
  txt: plain,
}

export function isKnownLanguage(lang: string): boolean {
  return lang.toLowerCase() in languages
}

export function languageOf(lang: string): { badge: string; name: string } {
  let language = languages[lang.toLowerCase()] ?? plain
  return { badge: language.badge, name: language.name }
}

const token =
  /("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\\n]|\\.)*`?)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'`]+?)/gy

/** Highlights `code` line by line into CodeEditor segments. */
export function highlight(code: string, lang: string): CodeSegment[][] {
  let language = languages[lang.toLowerCase()] ?? plain
  return code.split('\n').map((line) => highlightLine(line, language))
}

function highlightLine(line: string, language: Language): CodeSegment[] {
  if (language === plain) return line ? [['plain', line]] : []
  let out: CodeSegment[] = []
  let push = (kind: SyntaxKind, text: string) => {
    let last = out[out.length - 1]
    if (last && last[0] === kind) last[1] += text
    else out.push([kind, text])
  }

  let rest = line
  let comment = ''
  if (language.lineComment) {
    let at = commentStart(line, language.lineComment)
    if (at >= 0) {
      rest = line.slice(0, at)
      comment = line.slice(at)
    }
  }

  if (language === properties) {
    let eq = rest.indexOf('=')
    if (eq >= 0) {
      push('plain', rest.slice(0, eq + 1))
      if (eq + 1 < rest.length) push('string', rest.slice(eq + 1))
    } else if (rest) {
      push('plain', rest)
    }
  } else {
    token.lastIndex = 0
    while (token.lastIndex < rest.length) {
      let at = token.lastIndex
      let match = token.exec(rest)
      if (!match) {
        // Nothing matched here (e.g. `1a`): take one character as plain text.
        push('plain', rest[at]!)
        token.lastIndex = at + 1
        continue
      }
      let [text, string, number, word] = match
      if (string) push('string', text)
      else if (number) push('number', text)
      else if (word) push(wordKind(word, rest, token.lastIndex, language), text)
      else push('plain', text)
    }
  }
  if (comment) push('comment', comment)
  return out
}

function wordKind(word: string, line: string, end: number, language: Language): SyntaxKind {
  if (language.keywords.has(word)) return 'keyword'
  if (language.types.has(word)) return 'type'
  // Capitalised names are types, constructors included (`new Anthropic()`).
  if (language.capitalTypes && /^[A-Z]/.test(word)) return 'type'
  if (/^\s*\(/.test(line.slice(end))) return 'function'
  return 'plain'
}

/** Where a line comment starts, ignoring the marker inside strings. */
function commentStart(line: string, marker: string): number {
  let quote = ''
  for (let i = 0; i < line.length; i++) {
    let ch = line[i]!
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
    } else if (line.startsWith(marker, i)) {
      // `#` mid-word (a URL fragment, `a#b`) isn't a comment.
      if (marker === '#' && i > 0 && !/\s/.test(line[i - 1]!)) continue
      return i
    }
  }
  return -1
}
