import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { CodeEditor } from '@bits/ui/code-editor'
import { oddsAt, temperatureNote } from '@bits/ui/odds-bars'
import { formatOdds, showToken } from '@bits/ui/odds-list'
import { linkMeta } from '@bits/ui/rabbit-hole'
import { OutputPanel, TerminalLog, type TerminalEntry, type TerminalPart, type TerminalPrompt, type TerminalTone } from '@bits/ui/terminal'

import type {
  AttentionBlock,
  Block,
  CodeBlock,
  CompareBlock,
  NextTokenBlock,
  OddsBlock,
  Paragraph,
  PromptBlock,
  RabbitHoleBlock,
  TokenizerBlock,
  TrainingBlock,
} from '../content.ts'
import type { LessonView } from '../lesson-view.ts'
import { codeEditorProps, exerciseProps } from './exercise.ts'
import { inlineNodes } from './inline.tsx'

/**
 * Terminal mode (CodeLesson artboard): the lesson as a CLI session, with the
 * code editor and its output panel beside it when the lesson has code.
 * Mapping (components §10.15): markdown → `◆ tutor`, `:::quiz` → lettered
 * options, `:::prompt` → the input runs the exercise with `○`/`✓` check
 * lines, `:::terminal` → `$ cmd` + output, `:::odds`, `:::tokenizer` and
 * the toys (`:::nexttoken`, `:::training`, `:::attention`, `:::compare`) →
 * their CLI equivalents, `:::rabbithole` → a tutor turn with the links, `:::code` → the editor pane (pointed at from the
 * tutor's `↳ highlighted …` line).
 */
export function TerminalMode(handle: Handle<{ view: LessonView }>) {
  return () => {
    let { view } = handle.props
    let blocks = view.content.blocks
    let code = blocks.find((block): block is CodeBlock => block.type === 'code')
    let prompt = blocks.find((block): block is PromptBlock => block.type === 'prompt')
    let done = view.lessons.filter((l) => l.state === 'done').length
    let pct = Math.round((done / view.total) * 100)
    let log = (
      <TerminalLog
        path={`~/${view.course.slug}`}
        progress={`lesson ${view.index + 1}/${view.total} · ${pct}% →`}
        entries={terminalEntries(blocks)}
        replies={view.content.replies}
        prompt={prompt ? terminalPrompt(view, prompt) : undefined}
      />
    )
    if (!code) return <div mix={soloStyle}>{log}</div>
    let editor = codeEditorProps(code)
    return (
      <div mix={workspaceStyle}>
        {log}
        <section aria-label="Code editor" mix={editorColumn}>
          <div mix={editorFill}>
            <CodeEditor {...editor} />
          </div>
          {code.run ? <OutputPanel command={code.run.cmd} lines={code.run.lines} /> : null}
        </section>
      </div>
    )
  }
}

function terminalPrompt(view: LessonView, block: PromptBlock): TerminalPrompt {
  let props = exerciseProps(view, block)
  return {
    id: props.id,
    label: props.task,
    checks: props.checks,
    temperatures: props.temperatures,
    examples: props.examples,
    defaultDraft: props.defaultDraft,
    placeholder: props.placeholder,
    reward: props.reward,
    submit: props.submit,
    run: props.run,
  }
}

/** Joins markdown paragraphs into one pre-wrapped tutor body (blank line between). */
function tutorBody(paragraphs: Paragraph[]): RemixNode {
  return paragraphs.flatMap((paragraph, i) => (i === 0 ? inlineNodes(paragraph, true) : ['\n\n', ...inlineNodes(paragraph, true)]))
}

export function terminalEntries(blocks: Block[]): TerminalEntry[] {
  let entries: TerminalEntry[] = []
  let code = blocks.find((block): block is CodeBlock => block.type === 'code')
  for (let block of blocks) {
    switch (block.type) {
      case 'markdown': {
        if (block.ask) entries.push({ kind: 'learner', text: block.ask })
        let file = block.pointsAt ? code?.files.find((f) => f.file === block.pointsAt) : undefined
        entries.push({
          kind: 'tutor',
          body: tutorBody(block.paragraphs),
          pointer:
            file?.highlight ? (
              <>
                {'↳ highlighted '}
                <strong>{file.file}</strong>
                {` lines ${file.highlight.from}–${file.highlight.to}`}
              </>
            ) : undefined,
        })
        break
      }
      case 'terminal':
        if (block.ask) entries.push({ kind: 'learner', text: block.ask })
        entries.push({ kind: 'command', command: block.cmd, output: block.lines, summary: block.summary })
        break
      case 'quiz': {
        let question = inlineNodes(block.question, true)
        let previous = entries[entries.length - 1]
        // A question right after a tutor turn belongs to that turn (as drawn).
        let body: RemixNode =
          previous?.kind === 'tutor' && !previous.pointer ? (entries.pop(), [previous.body, '\n', ...question]) : question
        entries.push({
          kind: 'quiz',
          body,
          options: block.options.map((option) => ({ key: option.key, label: option.label, reply: option.explanation })),
        })
        break
      }
      case 'odds':
        entries.push(oddsEntry(block))
        break
      case 'tokenizer':
        entries.push(tokenizerEntry(block))
        break
      case 'nexttoken':
        entries.push(nextTokenEntry(block))
        break
      case 'training':
        entries.push(trainingEntry(block))
        break
      case 'attention':
        entries.push(attentionEntry(block))
        break
      case 'compare':
        entries.push(compareEntry(block))
        break
      case 'rabbithole':
        entries.push(rabbitHoleEntry(block))
        break
      case 'prompt':
        entries.push({
          kind: 'tutor',
          body: `${block.task}. Type it below: ↵ runs it, and the checks tick as you go.`,
        })
        break
      case 'code':
        // Shown in the editor pane.
        break
    }
  }
  return entries
}

const BAR = 24

function oddsEntry(block: OddsBlock): TerminalEntry {
  let t = block.slider
  let probs = oddsAt(block.candidates, t)
  let width = Math.max(...block.candidates.map(([token]) => token.length)) + 2
  return {
    kind: 'command',
    command: `odds --temperature ${t.toFixed(2)} "${block.prompt} ${block.blank}"`,
    output: block.candidates.map(([token], i): TerminalPart[] => {
      let p = probs[i] ?? 0
      let filled = Math.round(p * BAR)
      return [
        ['text', token.padEnd(width)],
        [i === 0 ? 'ion' : 'muted', '█'.repeat(filled)],
        ['muted', '·'.repeat(BAR - filled)],
        ['quiet', `${Math.round(p * 100)}%`.padStart(5)],
      ]
    }),
    summary: temperatureNote(t),
  }
}

const TOKEN_TONES: TerminalTone[] = ['volt', 'ion', 'synapse']

function tokenizerEntry(block: TokenizerBlock): TerminalEntry {
  let chars = block.tokens.reduce((sum, [text]) => sum + text.length, 0)
  return {
    kind: 'command',
    command: `tokenize "${block.sample}"`,
    output: [
      block.tokens.map(([text], i): TerminalPart => [TOKEN_TONES[i % 3]!, `[${text}]`]),
      [['muted', block.tokens.map(([, id]) => id).join(' ')]],
    ],
    summary: `${block.tokens.length} tokens · ${chars} characters`,
  }
}

const ILLUSTRATIVE = 'illustrative numbers, not a real model’s'

function nextTokenEntry(block: NextTokenBlock): TerminalEntry {
  let width = Math.max(...block.steps.map((step) => showToken(step.token).length)) + 2
  return {
    kind: 'command',
    command: `generate --show-odds "${block.prompt}"`,
    output: block.steps.map((step, i): TerminalPart[] => [
      ['quiet', `${String(i + 1).padStart(2)}  `],
      ['volt', showToken(step.token).padEnd(width)],
      ['ion', formatOdds(step.p).padStart(5)],
      ['muted', step.alternatives.length ? `   ${step.alternatives.map(([t, p]) => `${showToken(t)} ${formatOdds(p)}`).join('  ')}` : ''],
    ]),
    summary: `${block.prompt}${block.steps.map((step) => step.token).join('')}${block.illustrative ? `  (${ILLUSTRATIVE})` : ''}`,
  }
}

function trainingEntry(block: TrainingBlock): TerminalEntry {
  let width = Math.max(...block.snapshots.map((s) => s.step.toLocaleString('en-US').length))
  return {
    kind: 'command',
    command: `sample --checkpoints "${block.prompt}"`,
    output: block.snapshots.map((s): TerminalPart[] => [
      ['quiet', `step ${s.step.toLocaleString('en-US').padStart(width)}  `],
      ['ion', `loss ${s.loss.toFixed(2).padStart(5)}  `],
      ['text', `${block.prompt} ${s.text}`.replace(/\n/g, ' ')],
    ]),
    summary: block.illustrative ? ILLUSTRATIVE : undefined,
  }
}

function attentionEntry(block: AttentionBlock): TerminalEntry {
  let name = (i: number) => showToken(block.tokens[i] ?? '')
  return {
    kind: 'command',
    command: `attention "${block.tokens.join('')}"`,
    output: [...block.links]
      .sort((a, b) => a.from - b.from || b.weight - a.weight)
      .map((link): TerminalPart[] => [
        ['volt', name(link.from)],
        ['muted', ' → '],
        ['ion', name(link.to)],
        ['quiet', `  ${link.weight.toFixed(2)}`],
      ]),
    summary: [block.caption, block.illustrative ? ILLUSTRATIVE : undefined].filter(Boolean).join(' · ') || undefined,
  }
}

function compareEntry(block: CompareBlock): TerminalEntry {
  let output: TerminalPart[][] = []
  for (let row of block.rows) {
    if (row.prompt) output.push([['muted', '› '], ['text', row.prompt]])
    output.push([['muted', `[${block.left}] `], ['text', row.left]])
    output.push([['ion', `[${block.right}] `], ['text', row.right]])
  }
  return {
    kind: 'command',
    command: `compare "${block.left}" "${block.right}"`,
    output,
    summary: block.illustrative ? ILLUSTRATIVE : undefined,
  }
}

function rabbitHoleEntry(block: RabbitHoleBlock): TerminalEntry {
  return {
    kind: 'tutor',
    body: [
      'Down the rabbit hole:',
      ...block.links.flatMap((link) => [
        '\n↗ ',
        <a href={link.url} target="_blank" rel="noopener noreferrer" data-rmx-document="">
          {link.title}
        </a>,
        ` · ${link.by} · ${linkMeta(link)}`,
      ]),
    ],
  }
}

// Block, not flex: the log's own `flex: 1 1 460px` must not become a height.
const soloStyle = css({ width: '100%', maxWidth: '900px', margin: '0 auto' })
const workspaceStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-4)',
  alignItems: 'stretch',
  '@media (max-width: 759px)': { gap: 'var(--space-3)' },
})
const editorColumn = css({
  flex: '1.35 1 580px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
})
// Grow to the row height, never below the code's own height (the editor clips overflow).
const editorFill = css({ flex: '1 0 auto', display: 'flex', flexDirection: 'column', minWidth: 0, '& > *': { flex: '1 0 auto' } })
