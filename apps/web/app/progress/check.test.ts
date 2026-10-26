import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { LessonContent } from '../actions/courses/lesson/content.ts'
import { MAX_BLOCK_XP, MAX_LESSON_XP } from '../content/limits.ts'
import { checkLesson } from './check.ts'

// Content as it might sit in storage if it skipped the build's xp checks.
const inflated: LessonContent = {
  title: 'Inflated',
  order: 1,
  minutes: 5,
  xp: 1e9,
  blocks: [
    {
      type: 'prompt',
      id: 'p',
      xp: 1e6,
      task: 'Write anything',
      checks: [{ label: 'any', patterns: [{ source: '.' }] }],
      temperatures: [70],
      examples: [],
      success: { message: 'ok' },
    },
    {
      type: 'quiz',
      id: 'q',
      xp: 1e12,
      question: ['Pick'],
      options: [
        { key: 'a', label: 'a', correct: true, explanation: '' },
        { key: 'b', label: 'b', correct: false, explanation: '' },
      ],
    },
    {
      type: 'quiz',
      id: 'negative',
      xp: -50,
      question: ['Pick'],
      options: [{ key: 'a', label: 'a', correct: true, explanation: '' }],
    },
  ],
}

describe('checkLesson awards', () => {
  it('clamps stored xp to the block and lesson caps', () => {
    let checked = checkLesson('c', 'l', inflated, { prompts: { p: 'hello' }, ran: {}, quizzes: { q: ['a'], negative: ['a'] } })
    assert.equal(checked.ok, true)
    assert.deepEqual(
      checked.awards.map((award) => [award.kind, award.xp]),
      [
        ['exercise', MAX_BLOCK_XP],
        ['quiz', MAX_BLOCK_XP],
        ['quiz', 0],
        ['lesson', MAX_LESSON_XP - 2 * MAX_BLOCK_XP],
      ],
    )
    let total = checked.awards.reduce((sum, award) => sum + award.xp, 0)
    assert.equal(total, MAX_LESSON_XP)
  })

  it('never awards more than the lesson’s xp, even when blocks add up to more', () => {
    let content: LessonContent = { ...inflated, xp: 150 }
    let checked = checkLesson('c', 'l', content, { prompts: { p: 'hello' }, ran: {}, quizzes: { q: ['a'] } })
    assert.deepEqual(
      checked.awards.map((award) => award.xp),
      [100, 50, 0],
    )
  })
})
