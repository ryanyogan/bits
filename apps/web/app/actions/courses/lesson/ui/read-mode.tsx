import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { AskPanel } from '@bits/ui/ask-panel'
import { AttentionMap } from '@bits/ui/attention-map'
import { CodeEditor } from '@bits/ui/code-editor'
import { ComparePanel } from '@bits/ui/compare-panel'
import { FlowWindow } from '@bits/ui/flow'
import { MarblesTimeline } from '@bits/ui/marbles'
import { NextTokenPlayer } from '@bits/ui/next-token'
import { OddsBars } from '@bits/ui/odds-bars'
import { PromptComposer } from '@bits/ui/prompt-composer'
import { RabbitHole } from '@bits/ui/rabbit-hole'
import { StepsPlayer } from '@bits/ui/steps'
import { OutputPanel } from '@bits/ui/terminal'
import { TrainingScrubber } from '@bits/ui/training-scrubber'
import { attachedBlock, LearnerBubble, TutorMessage } from '@bits/ui/tutor'
import { VideoPlayer } from '@bits/ui/video-player'

import { draftKey } from '../../../../progress/draft-keys.ts'
import { hasVideo, quizAsAsk, type AskBlock, type Block } from '../content.ts'
import type { LessonView } from '../lesson-view.ts'
import { TokenizerToy } from '../public/tokenizer-toy.tsx'
import { askProps, codeEditorProps, draftPersist, exerciseProps, runLines } from './exercise.ts'
import { inlineNodes } from './inline.tsx'
import { proseNodes } from './prose.tsx'

/**
 * The lesson (Lesson artboard): the chat-style tutor, the lesson's one view
 * (decision 055). A lesson with a video opens with the player. Every block
 * renders on the server; only the interactive blocks (video, odds, prompt,
 * code, terminal, tokenizer, nexttoken, training, attention, steps, flow,
 * marbles) hydrate as islands.
 */
export function ReadMode(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    // Keys that survive a depth switch (decision 053): a shared block keeps
    // its key whichever depth's blocks sit around it, so an exercise keeps
    // its runs; a depth's blocks get keys of their own.
    let counts: Record<string, number> = {}
    let keyOf = (block: Block) => {
      let group = block.depth ?? 'shared'
      counts[group] = (counts[group] ?? 0) + 1
      return `${group}-${counts[group]}`
    }
    return (
      <div mix={columnStyle}>
        {hasVideo(view.content) ? <LessonVideo view={view} /> : null}
        {view.content.blocks.map((block, index) => (
          <ReadBlock key={keyOf(block)} view={view} block={block} index={index} />
        ))}
      </div>
    )
  }
}

/**
 * The lesson's video (decision 029), at the top of the lesson: the player
 * with chapters, captions and the synced transcript, resuming where the
 * learner stopped (the `video` draft). Optional: everything in it is in the
 * text below too. The player and the transcript share one hairline
 * (lesson-page.tsx's app layer).
 */
function LessonVideo(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    let video = view.content.video!
    return (
      <div data-lesson-video="">
        <VideoPlayer
          title={view.content.title}
          duration={video.duration}
          chapters={video.chapters.map((chapter) => ({ title: chapter.title, start: chapter.at }))}
          cues={video.cues}
          source={{ src: video.src }}
          initialTime={view.resumeAt}
          persist={draftPersist(view, draftKey.video)}
        />
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
            <TutorMessage>{proseNodes(block.paragraphs)}</TutorMessage>
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
        let editor = codeEditorProps(view, block)
        return (
          <div mix={codeStyle}>
            <CodeEditor {...editor} />
            {block.run?.ask ? <LearnerBubble variant="plain">{block.run.ask}</LearnerBubble> : null}
            {block.run ? <OutputPanel command={block.run.cmd} lines={runLines(block.run)} /> : null}
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
                lines={runLines(block)}
              />
            </div>
          </>
        )
      case 'ask':
        return <Ask view={view} block={block} />
      case 'quiz':
        // Stored quizzes are upgraded to asks when read (upgradeLessonContent).
        return <Ask view={view} block={quizAsAsk(block)} />
      case 'tokenizer':
        return (
          <div mix={attachedBlock}>
            <TokenizerToy id={`tokenizer-${index}`} sample={block.sample} tokens={block.tokens} illustrative={block.illustrative} />
          </div>
        )
      case 'nexttoken':
        return (
          <div mix={attachedBlock}>
            <NextTokenPlayer prompt={block.prompt} steps={block.steps} illustrative={block.illustrative} />
          </div>
        )
      case 'training':
        return (
          <div mix={attachedBlock}>
            <TrainingScrubber id={`training-${index}`} prompt={block.prompt} snapshots={block.snapshots} illustrative={block.illustrative} />
          </div>
        )
      case 'attention':
        return (
          <div mix={attachedBlock}>
            <AttentionMap tokens={block.tokens} links={block.links} caption={block.caption} illustrative={block.illustrative} />
          </div>
        )
      case 'compare':
        return (
          <div mix={attachedBlock}>
            <ComparePanel left={block.left} right={block.right} rows={block.rows} illustrative={block.illustrative} />
          </div>
        )
      case 'rabbithole':
        return (
          <div mix={attachedBlock}>
            <RabbitHole id={`rabbit-hole-${index}`} links={block.links} />
          </div>
        )
      case 'steps':
        return (
          <div mix={attachedBlock}>
            <StepsPlayer title={block.title} steps={block.steps} loop={block.loop} illustrative={block.illustrative} />
          </div>
        )
      case 'flow':
        return (
          <div mix={attachedBlock}>
            <FlowWindow title={block.title} capacity={block.capacity} unit={block.unit} items={block.items} illustrative={block.illustrative} />
          </div>
        )
      case 'marbles':
        return (
          <div mix={attachedBlock}>
            <MarblesTimeline
              id={`marbles-${index}`}
              title={block.title}
              duration={block.duration}
              unit={block.unit}
              lanes={block.lanes}
              illustrative={block.illustrative}
            />
          </div>
        )
    }
  }
}

/**
 * `:::ask` (and every `:::quiz`, compiled to one) in the prompt window
 * (decision 052): the learner types the answer or taps an option, and the
 * server grades it. Works without JS: the panel is a native form to
 * /api/ask, which redirects back here with the verdict.
 */
function Ask(handle: Handle<{ view: LessonView; block: AskBlock }>) {
  return () => {
    let { view, block } = handle.props
    return (
      <section aria-label="Quick check" mix={exerciseStyle}>
        <AskPanel {...askProps(view, block)} question={inlineNodes(block.question, true)} />
      </section>
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
const exerciseStyle = css({ display: 'flex', flexDirection: 'column' })
const codeStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
