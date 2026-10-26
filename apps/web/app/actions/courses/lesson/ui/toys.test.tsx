import * as path from 'node:path'

import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

import { coursesDir, readCourseFolder } from '../../../../../scripts/lib/content-folder.ts'
import { buildCourse } from '../../../../content/compile/index.ts'
import { terminalEntries } from './terminal-mode.tsx'

async function toyBlocks() {
  let dir = path.join(coursesDir, '../fixtures/toys')
  let result = buildCourse(await readCourseFolder(dir), { folder: 'toys' })
  return result.lessons!.get('every-toy')!.blocks
}

describe('lesson toys in Terminal mode', () => {
  it('maps each toy to its CLI equivalent', async () => {
    let entries = terminalEntries(await toyBlocks())
    let commands = entries.flatMap((entry) => (entry.kind === 'command' ? [entry.command] : []))
    assert.deepEqual(commands, [
      'generate --show-odds "The capital of France is"',
      'sample --checkpoints "Once upon a"',
      'attention "The animal didn\'t cross the street because it was tired"',
      'compare "Base model" "Assistant"',
    ])
    let generate = entries.find((entry) => entry.kind === 'command' && entry.command.startsWith('generate'))
    assert.match(generate?.kind === 'command' ? (generate.summary ?? '') : '', /The capital of France is Paris\. It.*illustrative/)

    let last = entries[entries.length - 1]
    assert.equal(last?.kind, 'tutor')
    let html = last?.kind === 'tutor' ? await renderToString(<p>{last.body}</p>) : ''
    assert.match(html, /Down the rabbit hole/)
    assert.match(html, /<a href="https:\/\/www.youtube.com\/watch\?v=wjZofJX0v4M" target="_blank" rel="noopener noreferrer" data-rmx-document="">/)
    assert.match(html, /Andrej Karpathy · video · 116 min · deep dive/)
  })
})
