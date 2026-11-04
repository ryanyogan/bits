import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buildCourse } from '../../app/content/compile/index.ts'
import { gradeRun } from '../../app/runs/grade.ts'
import { coursesDir, readCourseFolder } from '../lib/content-folder.ts'
import { courseExtras } from './course-cases.ts'
import { courseExercises, expandReference, parseLessonRange } from './extract.ts'

const COURSE_MD = `---
title: Extract test
track: foundations
level: beginner
summary: Cases from coached prompts.
outcomes: [Grade]
cover: { pattern: dots, sigil: E }
badge: { name: Eval, glyph: E }
---
`

const lesson = (order: number, slug: string, body: string) => ({
  path: `0${order}-${slug}.md`,
  text: `---\ntitle: ${slug}\norder: ${order}\nminutes: 5\nxp: 40\n---\n\nA lesson.\n\n${body}\n`,
})

function build(files: { path: string; text: string }[]) {
  let all = [{ path: 'course.md', text: COURSE_MD }, ...files].map((file) => ({ ...file, size: file.text.length }))
  let result = buildCourse(all, { folder: 'extract-test' })
  assert.equal(result.errors, 0, JSON.stringify(result.report.filter((item) => item.level === 'error')))
  return result.lessons!
}

const coached = `:::prompt{id="tidy" xp=20 coach}
Tidy the notes
- goal "Get tidy notes"
- draft "<notes>a, b, c</notes>\\nTidy these."
- check "Keeps the notes" /notes/i
- expect "Short" words<=50
- rubric "Is tidy" must
- hint "Say what tidy means."
- reference "<notes>…the notes…</notes>\\nTidy these notes into one list."
- run temperature=[0, 1.0]
- example T=0 "a b c"
- example T=1.0 "- a\\n- b\\n- c"
:::`

const plain = `:::prompt{id="plain" xp=20}
Say hi
- check "Says hi" /hi/i
:::`

describe('coach eval case extraction', () => {
  it('labels the reference pass, the draft fail, and live-temperature examples as replies to the reference', () => {
    let lessons = build([lesson(1, 'one', coached), lesson(2, 'two', plain)])
    let [exercise, ...rest] = courseExercises(lessons, { course: 'extract-test' })
    assert.equal(rest.length, 0, 'uncoached blocks are skipped')
    assert.equal(exercise!.block.id, 'tidy')
    assert.deepEqual(
      exercise!.cases.map((c) => [c.name, c.pass, c.reply ?? null]),
      [
        ['reference', true, null],
        ['draft', false, null],
        // The T=0 example has no label (T=0 never runs live), so it's skipped.
        ['example 2 (reply to the reference)', true, '- a\n- b\n- c'],
      ],
    )
    assert.equal(exercise!.cases[0]!.prompt, '<notes>a, b, c</notes>\nTidy these notes into one list.')
  })

  it('adds extras, filters by lesson order, and refuses extras for unknown exercises', () => {
    let lessons = build([lesson(1, 'one', coached), lesson(2, 'two', coached.replace('id="tidy"', 'id="tidy-2"'))])
    let extras = { 'extract-test': { 'tidy-2': [{ name: 'bad', prompt: 'draft' as const, reply: 'nope', pass: false }] } }
    let only2 = courseExercises(lessons, { course: 'extract-test', orders: parseLessonRange('2'), extras })
    assert.deepEqual(only2.map((e) => e.block.id), ['tidy-2'])
    assert.deepEqual(only2[0]!.cases.at(-1), { name: 'bad', prompt: '<notes>a, b, c</notes>\nTidy these.', reply: 'nope', pass: false })
    assert.throws(() => courseExercises(lessons, { course: 'extract-test', extras: { 'extract-test': { missing: [] } } }), /missing/)
  })

  it('parses lesson ranges', () => {
    assert.deepEqual([...parseLessonRange('10-13')!], [10, 11, 12, 13])
    assert.deepEqual([...parseLessonRange('1,4-5')!], [1, 4, 5])
    assert.equal(parseLessonRange(undefined), undefined)
    assert.throws(() => parseLessonRange('ten'), /Bad --lessons/)
  })

  it('leaves a reference alone when the draft has nothing to fill it with', () => {
    assert.equal(expandReference('<doc>…</doc> Sum up.', undefined), '<doc>…</doc> Sum up.')
    assert.equal(expandReference('<doc>…</doc> Sum up.', 'no tags here'), '<doc>…</doc> Sum up.')
    assert.equal(expandReference('<doc>full text</doc> Sum up.', '<doc>other</doc>'), '<doc>full text</doc> Sum up.')
  })

  it("builds prompting-that-works lesson 11 with a full reference that holds the block's prompt checks, and the planted-claim extra", async () => {
    let files = await readCourseFolder(path.join(coursesDir, 'prompting-that-works'))
    let result = buildCourse(files, { folder: 'prompting-that-works' })
    let [exercise] = courseExercises(result.lessons!, { course: 'prompting-that-works', orders: new Set([11]), extras: courseExtras })
    assert.equal(exercise!.block.id, 'research-brief')
    let reference = exercise!.cases.find((c) => c.name === 'reference')!
    assert.match(reference.prompt, /pyx\.example\/docs\/pricing/)
    let grade = gradeRun(exercise!.block, { prompt: reference.prompt, output: '', live: false }, new Set([100]))
    assert.deepEqual(grade.criteria.filter((c) => c.kind === 'check' && !c.met), [])
    let planted = exercise!.cases.find((c) => c.name.includes('completely free'))!
    assert.equal(planted.pass, false)
    // Every deterministic expect holds, so the judge decides it.
    let live = gradeRun(exercise!.block, { prompt: planted.prompt, output: planted.reply!, live: true }, new Set([100]))
    assert.equal(live.layer, 'judge')
  })
})
