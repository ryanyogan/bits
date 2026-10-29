import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { CodeEditor } from '@bits/ui/code-editor'
import { oddsAt, temperatureNote } from '@bits/ui/odds-bars'
import { formatOdds, showToken } from '@bits/ui/odds-list'
import { promptText } from '@bits/ui/next-token'
import { linkMeta } from '@bits/ui/rabbit-hole'
import { OutputPanel, TerminalLog, type TerminalEntry, type TerminalPart, type TerminalPrompt, type TerminalTone } from '@bits/ui/terminal'

import {
  quizAsAsk,
  type AskBlock,
  type AttentionBlock,
  type Block,
  type CodeBlock,
  type CompareBlock,
  type NextTokenBlock,
  type OddsBlock,
  type Paragraph,
  type PromptBlock,
  type RabbitHoleBlock,
  type TokenizerBlock,
  type TrainingBlock,
} from '../content.ts'
import type { LessonView } from '../lesson-view.ts'
import { askProps, codeEditorProps, exerciseProps, runLines } from './exercise.ts'
import { inlineNodes, inlineText } from './inline.tsx'

/**
 * Terminal mode (CodeLesson artboard): the lesson as a CLI session, with the
 * code editor and its output panel beside it when the lesson has code.
 * Mapping (components §10.15): markdown → `◆ tutor`, `:::ask` / `:::quiz`
 * → a quick check with lettered options that the input answers (graded on
 * the server, decision 052), `:::prompt` → the input runs the exercise with `○`/`✓` check
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
        entries={terminalEntries(blocks, view)}
        replies={view.content.replies}
        prompt={prompt ? terminalPrompt(view, prompt) : undefined}
        flush={!!code}
      />
    )
    if (!code) return <div mix={soloStyle}>{log}</div>
    let editor = codeEditorProps(view, code)
    // The workspace is a row of ruled cells (decision 047): session | editor
    // (+ its output), sharing one hairline, flush with the column's rails.
    return (
      <div mix={workspaceStyle}>
        <div mix={logCell}>{log}</div>
        <section aria-label="Code editor" mix={editorColumn}>
          <div mix={editorFill}>
            <CodeEditor {...editor} flush />
          </div>
          {code.run ? (
            <div mix={outputCell}>
              <OutputPanel command={code.run.cmd} lines={runLines(code.run)} flush />
            </div>
          ) : null}
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
    persist: props.persist,
  }
}

/** Joins markdown paragraphs into one pre-wrapped tutor body (blank line between). */
function tutorBody(paragraphs: Paragraph[]): RemixNode {
  return paragraphs.flatMap((paragraph, i) => (i === 0 ? inlineNodes(paragraph, true) : ['\n\n', ...inlineNodes(paragraph, true)]))
}

/** An ask's entry without a lesson to grade it in (tests): no endpoint. */
function askOnly(ask: AskBlock) {
  return {
    id: ask.id,
    placeholder: ask.placeholder,
    choices: ask.choices.map((choice) => ({ key: choice.key, label: choice.label })),
    multiple: ask.multiple,
    xp: ask.xp,
  }
}

/** The session's entries; with `view`, quick checks are graded through /api/ask. */
export function terminalEntries(blocks: Block[], view?: LessonView): TerminalEntry[] {
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
      case 'ask':
      case 'quiz': {
        // Quick checks (decision 052): the input answers them, graded on the server.
        let ask = block.type === 'quiz' ? quizAsAsk(block) : block
        let question = inlineNodes(ask.question, true)
        let previous = entries[entries.length - 1]
        // A question right after a tutor turn belongs to that turn (as drawn).
        let body: RemixNode =
          previous?.kind === 'tutor' && !previous.pointer ? (entries.pop(), [previous.body, '\n', ...question]) : question
        let props = view ? askProps(view, ask) : { ...askOnly(ask), passed: false }
        entries.push({ kind: 'ask', body, ask: { ...props, label: inlineText(ask.question) } })
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
        // Shown in the editor pane, Run output included. A run with an ask
        // or a summary also gets its command line in the session (the
        // output stays in the pane).
        if (block.run && (block.run.ask || block.run.summary)) {
          if (block.run.ask) entries.push({ kind: 'learner', text: block.run.ask })
          entries.push({ kind: 'command', command: block.run.cmd, output: [], summary: block.run.summary })
        }
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
    summary: `${promptText(block.prompt, block.steps)}${block.steps.map((step) => step.token).join('')}${block.illustrative ? `  (${ILLUSTRATIVE})` : ''}`,
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
// A lesson with no code keeps the boxed terminal, centred in the column.
const soloStyle = css({
  width: '100%',
  maxWidth: '900px',
  margin: '0 auto',
  boxSizing: 'border-box',
  padding: 'var(--space-8) var(--section-pad-x) var(--space-10)',
  '@media (max-width: 759px)': { padding: 'var(--space-4) var(--space-3) var(--space-6)' },
})
// Each cell draws its top and leading hairline and tucks it 1px outside
// itself; the workspace clips what lands on its own edges. Side by side
// that leaves one line between the cells, wrapped one line above the editor,
// and never a doubled line on the rails.
const workspaceStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', overflow: 'hidden' })
const cellEdges = {
  marginTop: 'calc(-1 * var(--border-w))',
  marginLeft: 'calc(-1 * var(--border-w))',
  borderTop: 'var(--border-w) solid var(--line-cell)',
  borderLeft: 'var(--border-w) solid var(--line-cell)',
} as const
const logCell = css({ ...cellEdges, flex: '1 1 460px', minWidth: 0, display: 'flex', '& > *': { flex: '1 1 auto' } })
const editorColumn = css({ ...cellEdges, flex: '1.35 1 580px', minWidth: 0, display: 'flex', flexDirection: 'column' })
// Grow to the row height, never below the code's own height (the editor clips overflow).
const editorFill = css({ flex: '1 0 auto', display: 'flex', flexDirection: 'column', minWidth: 0, '& > *': { flex: '1 0 auto' } })
const outputCell = css({ borderTop: 'var(--border-w) solid var(--line-cell)' })
