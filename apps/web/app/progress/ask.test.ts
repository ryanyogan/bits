import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { AskBlock } from '../actions/courses/lesson/content.ts'
import { gradeAsk, normalizeAnswer } from './ask.ts'

function ask(fields: Partial<AskBlock>): AskBlock {
  return { type: 'ask', id: 'q', xp: 10, gate: true, question: ['Q?'], accept: [], reject: [], choices: [], ...fields }
}

const picked = ask({
  choices: [
    { key: 'a', label: '“ the”', correct: true, explanation: 'Common words get their own token.' },
    { key: 'b', label: 'Unbelievably', correct: false, explanation: 'Rare words split.' },
  ],
})

const several = ask({
  multiple: true,
  choices: [
    { key: 'a', label: 'the', correct: true, explanation: '' },
    { key: 'b', label: 'ing', correct: true, explanation: '' },
    { key: 'c', label: 'a whole sentence', correct: false, explanation: '' },
  ],
})

const typed = ask({
  accept: [{ label: 'Mentions tokens', patterns: [{ source: 'token|chunk', flags: 'i' }] }],
  reject: [{ label: 'Blames memory', patterns: [{ source: 'memor', flags: 'i' }], feedback: 'Not memory.' }],
  hint: 'Think about what it reads.',
  explain: 'It reads tokens.',
})

describe('gradeAsk (decision 052)', () => {
  it('reads a choice by its letter or its text, ignoring case and punctuation', () => {
    assert.equal(normalizeAnswer('  “ The”! '), 'the')
    for (let answer of ['a', '(a)', 'A.', 'the', '“ the”']) assert.equal(gradeAsk(picked, answer).correct, true, answer)
    let wrong = gradeAsk(picked, 'b')
    assert.equal(wrong.correct, false)
    assert.equal(wrong.feedback, 'Rare words split.')
  })

  it('never grades an answer that names no option as a guess', () => {
    let grade = gradeAsk(picked, 'no idea')
    assert.equal(grade.correct, false)
    assert.match(grade.feedback, /Pick one of the options/)
  })

  it('needs every right option for a multiple ask', () => {
    assert.equal(gradeAsk(several, 'a, b').correct, true)
    assert.equal(gradeAsk(several, 'the and ing').correct, true)
    let partial = gradeAsk(several, 'a')
    assert.equal(partial.correct, false)
    assert.match(partial.feedback, /name every right option/)
    assert.equal(gradeAsk(several, 'a, b, c').correct, false)
  })

  it('grades typed answers: every accept, no reject, with feedback', () => {
    let right = gradeAsk(typed, 'It sees tokens')
    assert.deepEqual([right.correct, right.feedback], [true, 'It reads tokens.'])
    let rejected = gradeAsk(typed, 'Its memory of tokens fails')
    assert.deepEqual([rejected.correct, rejected.feedback], [false, 'Not memory.'])
    assert.deepEqual(
      rejected.checks.map((check) => [check.kind, check.passed]),
      [
        ['accept', true],
        ['reject', false],
      ],
    )
    assert.deepEqual([gradeAsk(typed, 'letters').correct, gradeAsk(typed, 'letters').feedback], [false, 'Think about what it reads.'])
  })

  it('treats options without a right one as suggestions, graded by the accept lines', () => {
    let suggested = ask({
      ...typed,
      choices: [
        { key: 'a', label: 'It sees tokens', correct: false, explanation: '' },
        { key: 'b', label: 'Bad memory', correct: false, explanation: '' },
      ],
    })
    assert.equal(gradeAsk(suggested, 'It sees tokens').correct, true)
    assert.equal(gradeAsk(suggested, 'Bad memory').correct, false)
  })

  it('fails a stored pattern outside the grammar without running it', () => {
    let evil = ask({ accept: [{ label: 'Evil', patterns: [{ source: '(a+)+$' }] }] })
    assert.equal(gradeAsk(evil, `${'a'.repeat(30)}!`).correct, false)
    assert.equal(gradeAsk(evil, 'aaa').correct, false)
  })
})
