// The snippet check (decision 076): every `:::code{file tag}` in a
// build-along course must match that file at that tag in a local checkout
// of the course repo (`git show <tag>:<file>`). `pnpm content snippets` runs
// it; it isn't part of the build, which stays pure.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { TaggedSnippet } from '../../app/content/compile/lesson.ts'

const run = promisify(execFile)

/** A line that stands for skipped code: `...`, `…`, `// ...`, `# …`, `/* ... *\/`, `<!-- ... -->`. */
const ELISION = /^\s*(?:\/\/|#|\/\*|<!--)?\s*(?:\.\.\.|…)\s*(?:\*\/|-->)?\s*$/

export interface SnippetProblem {
  /** The lesson file and line, for `path:line: error: text`. */
  path: string
  line: number
  text: string
}

/**
 * Where `snippet` stops matching `source`, or undefined when it matches.
 * Elision lines split the snippet into runs; each run must appear as
 * consecutive lines, in order, after the one before it. Trailing spaces are
 * ignored; indentation isn't. Returns the index of the first snippet line
 * that couldn't be placed.
 */
export function snippetMismatch(snippet: string[], source: string): number | undefined {
  let file = source.split('\n').map(trimEnd)
  let runs: { at: number; lines: string[] }[] = []
  let current: { at: number; lines: string[] } | undefined
  snippet.forEach((text, i) => {
    if (ELISION.test(text)) {
      current = undefined
      return
    }
    if (!current) runs.push((current = { at: i, lines: [] }))
    current.lines.push(trimEnd(text))
  })
  let from = 0
  for (let { at, lines } of runs) {
    // Blank lines at a run's edges sit next to an elision; don't hold them to the file.
    let start = lines.findIndex((text) => text !== '')
    if (start < 0) continue
    let end = lines.length
    while (lines[end - 1] === '') end--
    let body = lines.slice(start, end)
    let best = { matched: -1, index: -1 }
    for (let i = from; i <= file.length - 1; i++) {
      let matched = 0
      while (matched < body.length && file[i + matched] === body[matched]) matched++
      if (matched > best.matched) best = { matched, index: i }
      if (matched === body.length) break
    }
    if (best.matched < body.length) return at + start + Math.max(best.matched, 0)
    from = best.index + body.length
  }
  return undefined
}

/** Checks each snippet against `git show <tag>:<file>` in `repoDir`. */
export async function checkSnippets(repoDir: string, snippets: (TaggedSnippet & { path: string })[]): Promise<SnippetProblem[]> {
  let problems: SnippetProblem[] = []
  let cache = new Map<string, Promise<string | Error>>()
  for (let snippet of snippets) {
    let key = `${snippet.tag}:${snippet.file}`
    if (!cache.has(key)) cache.set(key, gitShow(repoDir, snippet.tag, snippet.file))
    let source = await cache.get(key)!
    if (source instanceof Error) {
      problems.push({ path: snippet.path, line: snippet.line, text: `${snippet.file} isn't in the repo at ${snippet.tag} (${source.message})` })
      continue
    }
    let miss = snippetMismatch(snippet.lines, source)
    if (miss !== undefined) {
      problems.push({
        path: snippet.path,
        line: snippet.line + miss,
        text: `this line isn't in ${snippet.file} at ${snippet.tag}: “${snippet.lines[miss]!.trim()}”`,
      })
    }
  }
  return problems
}

async function gitShow(repoDir: string, tag: string, file: string): Promise<string | Error> {
  try {
    // execFile, never a shell: the tag and path come from lesson files.
    let { stdout } = await run('git', ['-C', repoDir, 'show', `refs/tags/${tag}:${file.replace(/^\.\//, '')}`], {
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    let message = String((error as { stderr?: string }).stderr ?? error).trim().split('\n')[0] ?? 'git show failed'
    return new Error(message.replace(/^fatal: /, ''))
  }
}

function trimEnd(text: string): string {
  return text.replace(/\s+$/, '')
}
