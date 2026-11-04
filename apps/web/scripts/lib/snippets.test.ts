import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { checkSnippets, snippetMismatch } from './snippets.ts'

const notes = ['export function addNote(text: string) {', '  let note = { text }', '  notes.push(note)', '  return note', '}', ''].join('\n')

describe('snippet check (decision 076)', () => {
  it('matches consecutive lines, ignoring trailing spaces, with … for skipped code', () => {
    assert.equal(snippetMismatch(['  notes.push(note)  ', '  return note'], notes), undefined)
    assert.equal(snippetMismatch(['export function addNote(text: string) {', '  // …', '  return note', '}'], notes), undefined)
    // Indentation counts, and so does order.
    assert.equal(snippetMismatch(['notes.push(note)'], notes), 0)
    assert.equal(snippetMismatch(['  return note', '...', '  notes.push(note)'], notes), 2)
    // Without an elision line, skipping a line is a mismatch at the line that doesn't follow.
    assert.equal(snippetMismatch(['  let note = { text }', '  return note'], notes), 1)
  })

  it('checks tagged snippets against git show <tag>:<file> in a checkout', async () => {
    let repo = await fs.mkdtemp(path.join(os.tmpdir(), 'bits-snippets-'))
    try {
      let git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' })
      git('init', '-q')
      git('config', 'user.email', 'test@bits.local')
      git('config', 'user.name', 'Test')
      await fs.mkdir(path.join(repo, 'src'))
      await fs.writeFile(path.join(repo, 'src/notes.ts'), notes)
      git('add', '.')
      git('commit', '-qm', 'b-05')
      git('tag', 'b-05')
      // The next commit changes the file; the tag still holds the old text.
      await fs.writeFile(path.join(repo, 'src/notes.ts'), notes.replace('return note', 'return { ...note }'))
      git('commit', '-qam', 'b-06')
      git('tag', 'b-06')

      let snippet = (tag: string, file: string, lines: string[]) => ({ tag, file, lines, line: 12, path: '05-notes.md' })
      let problems = await checkSnippets(repo, [
        snippet('b-05', 'src/notes.ts', ['  notes.push(note)', '  return note']),
        snippet('b-06', 'src/notes.ts', ['  notes.push(note)', '  return note']),
        snippet('b-05', 'src/missing.ts', ['x']),
        snippet('z-99', 'src/notes.ts', ['x']),
      ])
      assert.deepEqual(
        problems.map((problem) => [problem.path, problem.line, problem.text.replace(/ \(.*\)$/, ' (…)')]),
        [
          ['05-notes.md', 13, "this line isn't in src/notes.ts at b-06: “return note”"],
          ['05-notes.md', 12, "src/missing.ts isn't in the repo at b-05 (…)"],
          ['05-notes.md', 12, "src/notes.ts isn't in the repo at z-99 (…)"],
        ],
      )
    } finally {
      await fs.rm(repo, { recursive: true, force: true })
    }
  })
})
