import type { Handle } from 'remix/component'
import { attrs, css } from 'remix/component'
import { CodeEditor } from '@bits/ui/code-editor'
import { Keycap } from '@bits/ui/keycap'
import { OddsBars } from '@bits/ui/odds-bars'
import { PromptComposer } from '@bits/ui/prompt-composer'
import { QuizChoice, type QuizOption } from '@bits/ui/quiz-choice'
import { OutputPanel } from '@bits/ui/terminal'
import { attachedBlock, LearnerBubble, TutorMessage } from '@bits/ui/tutor'

import type { Block, QuizBlock } from '../content.ts'
import type { LessonView } from '../lesson-view.ts'
import { TokenizerToy } from '../public/tokenizer-toy.tsx'
import { codeEditorProps, exerciseProps } from './exercise.ts'
import { inlineNodes } from './inline.tsx'

/**
 * Read mode (Lesson artboard): the chat-style tutor. Every block renders on
 * the server; only the interactive blocks (odds, prompt, code, terminal,
 * tokenizer) hydrate as islands.
 */
export function ReadMode(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    return (
      <div mix={columnStyle}>
        {view.content.blocks.map((block, index) => (
          <ReadBlock key={index} view={view} block={block} index={index} />
        ))}
      </div>
    )
  }
}

function ReadBlock(handle: Handle<{ view: LessonView; block: Block; index: number }>) {
  return () => {
    let { view, block, index } = handle.props
    switch (block.type) {
      case 'markdown':
        return (
          <>
            {block.ask ? <LearnerBubble variant="plain">{block.ask}</LearnerBubble> : null}
            <TutorMessage>
              {block.paragraphs.map((paragraph, i) => (
                <p key={i}>{inlineNodes(paragraph)}</p>
              ))}
            </TutorMessage>
          </>
        )
      case 'odds':
        return (
          <div mix={attachedBlock}>
            <OddsBars
              id={`odds-${index}`}
              context={block.prompt}
              blank={block.blank}
              candidates={block.candidates}
              defaultValue={Math.round(block.slider * 100)}
            />
          </div>
        )
      case 'prompt': {
        let props = exerciseProps(view, block)
        return (
          <section id="exercise" aria-label="Exercise" mix={exerciseStyle}>
            <PromptComposer {...props} keepRuns={4} />
          </section>
        )
      }
      case 'code': {
        let editor = codeEditorProps(block)
        return (
          <div mix={codeStyle}>
            <CodeEditor {...editor} />
            {block.run ? <OutputPanel command={block.run.cmd} lines={block.run.lines} /> : null}
          </div>
        )
      }
      case 'terminal':
        return (
          <>
            {block.ask ? <LearnerBubble variant="plain">{block.ask}</LearnerBubble> : null}
            <div mix={attachedBlock}>
              <OutputPanel
                command={block.cmd}
                lines={block.summary ? [...block.lines, [['muted', block.summary]]] : block.lines}
              />
            </div>
          </>
        )
      case 'quiz':
        return <Quiz view={view} block={block} />
      case 'tokenizer':
        return (
          <div mix={attachedBlock}>
            <TokenizerToy id={`tokenizer-${index}`} sample={block.sample} tokens={block.tokens} />
          </div>
        )
    }
  }
}

/**
 * `:::quiz` as the canonical choice card. It submits with GET to this same
 * page (`?quiz-<id>=<key>`), so checking an answer works without JS and the
 * result is a shareable URL.
 */
function Quiz(handle: Handle<{ view: LessonView; block: QuizBlock }>) {
  return () => {
    let { view, block } = handle.props
    let picked = view.answers[block.id] ?? []
    let answered = picked.length > 0
    let options: QuizOption[] = block.options.map((option) => ({
      value: option.key,
      label: option.label,
      checked: picked.includes(option.key),
      result: picked.includes(option.key) ? (option.correct ? 'correct' : 'incorrect') : undefined,
    }))
    let chosen = block.options.filter((option) => picked.includes(option.key))
    let explanation = answered ? chosen.map((option) => option.explanation).join(' ') : undefined
    let anchor = `quiz-${block.id}`
    return (
      <div id={anchor} mix={[attachedBlock, quizStyle]}>
        <QuizChoice
          name={anchor}
          question={inlineNodes(block.question)}
          options={options}
          multiple={block.multiple}
          explanation={explanation}
          formAction={`${view.href.self}#${anchor}`}
          action={
            <>
              {view.mode !== 'read' ? <input type="hidden" name="mode" value={view.mode} /> : null}
              <Keycap type="submit" size="md" mix={attrs({ formMethod: 'get' })}>
                {answered ? 'Check again' : 'Check'}
              </Keycap>
            </>
          }
        />
      </div>
    )
  }
}

const columnStyle = css({
  maxWidth: 'var(--read-width)',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-7)',
  '@media (max-width: 759px)': { gap: 'var(--space-5_5)' },
})
// The composer's runs list and toast sit in the column flow above it.
const exerciseStyle = css({ display: 'flex', flexDirection: 'column', scrollMarginTop: '96px' })
const codeStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
const quizStyle = css({ scrollMarginTop: '96px' })
