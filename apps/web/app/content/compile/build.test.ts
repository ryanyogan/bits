import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { coursesDir, listCourseFolders, readCourseFolder } from '../../../scripts/lib/content-folder.ts'
import { exercisesOf } from '../../actions/courses/lesson/content.ts'
import { buildCourse, formatItem, type SourceFile } from './index.ts'
import { checkPattern, MAX_OPTIONALS } from './regex.ts'

const course = `---
title: Test
track: foundations
level: beginner
summary: A test course.
outcomes: [Pass]
cover: { pattern: dots, sigil: T }
badge: { name: Test, glyph: T }
---
`

function lesson(body: string, frontmatter = 'title: One\norder: 1\nminutes: 5\nxp: 10') {
  return `---\n${frontmatter}\n---\n\n${body}\n`
}

function build(files: Record<string, string>) {
  let sources: SourceFile[] = Object.entries({ 'course.md': course, ...files }).map(([p, text]) => ({ path: p, text, size: text.length }))
  return buildCourse(sources, { folder: 'test' })
}

const errors = (result: ReturnType<typeof build>) => result.report.filter((item) => item.level === 'error').map(formatItem)

describe('content build', () => {
  it('builds the repo courses into the lesson shapes', async () => {
    let dir = path.join(coursesDir, 'tokens-and-temperature')
    let result = buildCourse(await readCourseFolder(dir), { folder: 'tokens-and-temperature' })
    assert.equal(result.errors, 0)
    assert.equal(result.manifest?.lessons, 8)
    assert.deepEqual(result.manifest?.modules.map((m) => m.title), ['How text becomes numbers', 'Picking the next word', 'Putting it together'])
    let temperature = result.lessons!.get('temperature')!
    let [exercise] = exercisesOf(temperature)
    assert.equal(exercise?.id, 'moon-tagline')
    assert.deepEqual(exercise?.checks[1]?.patterns, [
      { source: 'coffee|caf[eé]', flags: 'i' },
      { source: 'moon|lunar', flags: 'i' },
    ])
    assert.deepEqual(exercise?.run, { label: 'Ran at 0 and 1.0', temperatures: [0, 1] })
    assert.deepEqual(exercise?.temperatures, [0, 0.7, 1])
    assert.equal(temperature.video?.duration, 270)
    assert.equal(temperature.video?.cues.length, 3)
    let odds = temperature.blocks.find((block) => block.type === 'odds')
    assert.deepEqual(odds?.type === 'odds' && odds.candidates[0], [' Brew', 3.1])
  })

  it('turns paragraphs, ::ask and ==marks== into tutor turns', () => {
    let result = build({
      '01-one.md': lesson('Hello **there**, `code`\nand ==this==.\n\n---\n\n::ask[why?]\n\nBecause.'),
    })
    assert.deepEqual(errors(result), [])
    assert.deepEqual(result.lessons?.get('one')?.blocks, [
      { type: 'markdown', paragraphs: [['Hello ', { strong: 'there' }, ', ', { code: 'code' }, ' and ', { mark: 'this' }, '.']] },
      { type: 'markdown', paragraphs: [['Because.']], ask: 'why?' },
    ])
  })

  it('groups adjacent :::code blocks and takes the next :::terminal as Run output', () => {
    let result = build({
      '01-one.md': lesson(
        ':::code{file="a.ts" lang="ts"}\nconst a = 1 // one\n:::\n\n:::code{file="b.sh" lang="sh"}\necho hi\n:::\n\n:::terminal{cmd="run"}\n[ion]ok[quiet] done\n:::',
      ),
    })
    assert.deepEqual(errors(result), [])
    let [code] = result.lessons!.get('one')!.blocks
    assert.equal(code?.type, 'code')
    if (code?.type !== 'code') return
    assert.deepEqual(code.files.map((f) => f.file), ['a.ts', 'b.sh'])
    assert.deepEqual(code.files[0]?.lines[0], [['keyword', 'const'], ['plain', ' a = '], ['number', '1'], ['plain', ' '], ['comment', '// one']])
    assert.deepEqual(code.run, { cmd: 'run', lines: [[['ion', 'ok'], ['quiet', ' done']]] })
  })

  it('reports problems with file and line', () => {
    let result = build({
      '01-one.md': lesson(':::prompt{id="p"}\nDo it.\n- check "bad" /(a+)+/\n:::\n\n# Heading\n\n<b>hi</b>'),
      '02-two.md': lesson(':::quiz{id="q"}\nPick one\n- [x] a\n- [x] b\n:::\n\n:::code{file="x"}\nx\n', 'title: Two\norder: 1\nminutes: 5\nxp: 10'),
      '03-three.md': lesson('Hi', 'title: Three\norder: 3\nminutes: lots\nxp: 10'),
    })
    assert.deepEqual(errors(result), [
      '01-one.md → duplicate order: 1 (also in 02-two.md)',
      '01-one.md:10 → check “bad”: /(a+)+/ uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/',
      '01-one.md:13 → headings aren’t supported in lessons (the page has its own); write a paragraph',
      '01-one.md:15 → raw HTML isn’t allowed in lessons',
      '02-two.md:8 → :::quiz has 2 right answers: add multiple to allow several',
      '02-two.md:14 → :::code is never closed: add a ::: line after it',
      '03-three.md:4 → minutes: Expected number',
    ])
    assert.equal(result.manifest, undefined)
  })

  it('accepts only the check grammar: no repetition, few optionals, few paths', () => {
    let rejected: [string, RegExp][] = [
      // Classic exponential shapes.
      ['(a+)+$', /repetition/],
      ['(a|a)*', /repetition/],
      ['(?:\\w*)*', /repetition/],
      ['a*b*c*', /repetition/],
      [`${'a?'.repeat(MAX_OPTIONALS + 1)}${'a'.repeat(MAX_OPTIONALS + 1)}`, /more than 4 optional parts/],
      // The reviewer's bypasses of the old analyzer.
      ['[]a+]+', /empty character class/], // a class starting with ]
      ['[^]a]', /empty character class/],
      ['(a|ab){1,20}', /repetition/], // bounded repeats skipped the overlap check
      ['(a|a){2,9}c', /repetition/],
      ['\\w{1,99}\\s{1,99}x', /repetition/], // {n,m} wasn't counted as unbounded
      ['x{3}', /repetition/],
      ['a}', /repetition/],
      // Without repetition, alternatives still multiply: cap the paths.
      ['(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)x', /more than 64 ways/],
      // Groups and escapes outside the grammar.
      ['(?=moon)', /\(\?…\) group/],
      ['(?<!x)moon', /\(\?…\) group/],
      ['(?<w>a)', /\(\?…\) group/],
      ['(a)\\1', /backreference/],
      ['\\k<w>', /backreference/],
      ['\\p{L}', /uses \\p/],
      ['\\x41', /uses \\x/],
      ['a]', /unescaped \]/],
      ['[a[b]]', /nested classes/],
      ['^?a', /doesn't compile|\? that doesn’t follow/],
      ['a??', /\? that doesn’t follow/],
      // The basics stay.
      ['a'.repeat(201), /201 characters long/],
      ['(', /doesn't compile/],
    ]
    for (let [source, problem] of rejected) {
      assert.match(checkPattern(source, 'i') ?? 'accepted', problem, source)
    }
    assert.match(checkPattern('moon', 'g') ?? 'accepted', /flags "g"/)

    let accepted = [
      'tagline|slogan',
      'coffee|caf[eé]',
      '\\bwords?\\b|\\bshort\\b|\\bunder\\b|\\bmax',
      '^(?:cat|dog)s?$',
      '[a-z0-9_\\-]',
      '[^\\s\\]]x',
      '\\.\\(\\)\\[\\]\\{\\}\\*\\+\\?\\|\\^\\$\\\\\\/',
      'colou?r',
      '.',
    ]
    for (let source of accepted) assert.equal(checkPattern(source, 'iu'), null, source)
  })

  it('accepts every check in the real courses', async () => {
    let checked = 0
    for (let dir of await listCourseFolders()) {
      let result = buildCourse(await readCourseFolder(dir), { folder: path.basename(dir) })
      assert.deepEqual(errors(result), [], dir)
      for (let content of result.lessons?.values() ?? []) {
        for (let block of exercisesOf(content)) {
          for (let check of block.checks) {
            for (let pattern of check.patterns) {
              assert.equal(checkPattern(pattern.source, pattern.flags), null, pattern.source)
              checked++
            }
          }
        }
      }
    }
    assert.ok(checked >= 4, `found ${checked} patterns`)
  })

  it('reports a bad check as a build error at its line', () => {
    let result = build({ '01-one.md': lesson(':::prompt{id="p"}\nDo it.\n- check "slow" /(a|a)*b/\n:::') })
    assert.deepEqual(errors(result), [
      '01-one.md:10 → check “slow”: /(a|a)*b/ uses repetition (*, + or {n}), which isn’t allowed in checks; list the alternatives instead, like /words?|short/',
    ])
  })

  it('rejects xp outside 0–100 per block and 0–500 per lesson', () => {
    let result = build({
      '01-one.md': lesson(
        ':::prompt{id="p" xp=1000000}\nDo it.\n- check "any" /./\n:::\n\n:::quiz{id="q" xp=-5}\nPick\n- [x] a\n- [ ] b\n:::',
        'title: One\norder: 1\nminutes: 5\nxp: 999999',
      ),
    })
    assert.deepEqual(errors(result), [
      '01-one.md:5 → xp: Expected number less than or equal to 500',
      '01-one.md:8 → xp=1000000 is out of range: use a whole number from 0 to 100',
      '01-one.md:13 → xp=-5 is out of range: use a whole number from 0 to 100',
    ])
  })
})
