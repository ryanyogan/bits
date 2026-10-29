import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Keycap } from './keycap.tsx'
import { TEMPERATURE_EVENT } from './odds-bars.tsx'
import { readDraft, writeDraft, type DraftPersist } from './lib/drafts.ts'
import { prefetchFor } from './lib/prefetch.ts'
import { runNote, streamRun, type RunEndpoint } from './lib/run-stream.ts'
import { createFollower, Ghost, scrollWindowStyle, stackStyle } from './lib/stable.tsx'
import { focusOutline, FORCED_COLORS, forcedMark, forcedSelected } from './lib/states.ts'
import {
  cannedOutput,
  checkPasses,
  submitFieldInputs,
  type PromptCheck,
  type SubmitFields,
  type TemperatureOption,
} from './prompt-composer.tsx'
import { announceReward, type RewardNext } from './reward-toast.tsx'
import { ToolButton } from './tool-button.tsx'

export type TerminalTone = 'text' | 'muted' | 'quiet' | 'ion' | 'volt' | 'synapse'

/** A coloured run of terminal text. */
export type TerminalPart = [tone: TerminalTone, text: string]
/**
 * Entries cross the island boundary as data: `body`/`pointer` JSX may use
 * plain elements (`<code>`, `<mark>`, `<strong>`), never `mix` or components.
 */
export type TerminalEntry =
  | { kind: 'learner'; text: string }
  | { kind: 'tutor'; body: RemixNode; pointer?: RemixNode }
  | { kind: 'command'; command: string; output: TerminalPart[][]; summary?: string }
  /** A `:::quiz` in Terminal mode: tutor text plus lettered option buttons (components §6.4). */
  | { kind: 'quiz'; body?: RemixNode; options: TerminalQuizOption[] }

export interface TerminalQuizOption {
  /** Letter shown in brackets, e.g. "a". */
  key: string
  label: string
  /** Tutor reply appended when the option is picked. */
  reply: string
}

export interface TerminalReplies {
  /** Reply when the learner's line contains "hint". */
  hint: string
  /** Any other reply. */
  fallback: string
}

/**
 * A `:::prompt` exercise in Terminal mode (components §10.15): the input
 * becomes the prompt input with the checks listed above it as `○` / `✓`
 * lines. It shares the PromptComposer's draft (same `id`, same storage key),
 * so switching modes keeps the learner's prompt.
 */
export interface TerminalPrompt {
  id: string
  /** Accessible label for the input (the task). */
  label: string
  checks: PromptCheck[]
  temperatures?: TemperatureOption[]
  /** Canned outputs per temperature value (T × 100), cycled per run. */
  examples?: Record<string, string[]>
  defaultDraft?: string
  placeholder?: string
  reward?: { xp: number; message: string; next?: RewardNext }
  /** Also submit the draft with another form (see SubmitFields). */
  submit?: SubmitFields
  /** Run through the server (/api/run), as the PromptComposer does; else canned `examples`. */
  run?: RunEndpoint
  /** Where the draft is kept (shared with the PromptComposer); defaults to localStorage under `id`. */
  persist?: DraftPersist
}

export interface TerminalLogProps {
  /** e.g. "~/first-agent-loop". */
  path: string
  /** e.g. "lesson 4/10 · 18% →". */
  progress?: string
  entries: TerminalEntry[]
  /** Canned tutor replies for the free-text input (ignored in prompt mode). */
  replies?: TerminalReplies
  /** Turns the input into a prompt exercise. */
  prompt?: TerminalPrompt
  placeholder?: string
  /** Appended entries kept on screen. */
  keepAppended?: number
  /** No outer border: a ruled parent draws the cell's hairlines (decision 047). */
  flush?: boolean
}

/** A run's reply: a live model reply or canned output (with a note saying why). */
interface ModelEntry {
  kind: 'model'
  id: number
  temperature: string
  text: string
  live: boolean
  streaming?: boolean
  note?: string
}

type AppendedEntry =
  | (TerminalEntry & { id: number })
  | ModelEntry
  | { kind: 'reward'; id: number; xp: number; message: string; next?: RewardNext }

const DEFAULT_REPLIES: TerminalReplies = {
  hint: 'Re-read the last tutor message: the answer is in there.',
  fallback: 'Good thinking. Keep going.',
}

const DEFAULT_TEMPS: TemperatureOption[] = [
  { value: 0, label: '0' },
  { value: 70, label: '0.7' },
  { value: 100, label: '1.0' },
]

/**
 * Terminal-mode lesson (components §10.15): a `role="log"` of learner lines,
 * tutor blocks, command output and quizzes, and a prompt input.
 * Server-rendered entries read in order with JS off; as a client entry the
 * input appends the learner's line and a canned tutor reply, quiz options
 * append the pick and its reply, and with `prompt` the input runs the
 * exercise (live checks, example output, reward). The panel is a fixed
 * height (`--terminal-height`) and the log scrolls inside it, like a real
 * terminal: it opens at the top of the lesson, and once the learner acts it
 * follows new lines while they're at the bottom (decision 023). Client entry.
 */
export const TerminalLog = clientEntry(
  import.meta.url,
  function TerminalLog(handle: Handle<TerminalLogProps>) {
    let appended: AppendedEntry[] = []
    let count = 0
    let value = handle.props.prompt?.persist?.saved?.value ?? handle.props.prompt?.defaultDraft ?? ''
    let hydrated = false
    let temperature = (handle.props.prompt?.temperatures ?? DEFAULT_TEMPS)[0]!
    let ranAt = new Set<number>()
    let runs = 0
    let rewarded = false
    // Opens at the start of the lesson; the learner's first action pins it.
    let follower = createFollower({ startPinned: false })

    let persist = (prompt: TerminalPrompt): DraftPersist => prompt.persist ?? { id: prompt.id, key: 'prompt' }

    handle.queueTask(() => {
      let prompt = handle.props.prompt
      if (prompt) value = readDraft(persist(prompt)) ?? prompt.defaultDraft ?? ''
      hydrated = true
      handle.update()
    })

    function append(...entries: AppendedEntry[]) {
      appended = [...appended, ...entries].slice(-(handle.props.keepAppended ?? 6))
      follower.pin()
      handle.update()
    }

    // The server run in flight; running again aborts it.
    let inflight: AbortController | undefined
    handle.signal.addEventListener('abort', () => inflight?.abort())

    async function runPrompt(prompt: TerminalPrompt, text: string) {
      let n = ++runs
      let at = temperature
      let model: ModelEntry = { kind: 'model', temperature: at.label, text: '', id: 0, live: false }
      if (prompt.run) {
        inflight?.abort()
        let controller = (inflight = new AbortController())
        model.id = ++count
        model.streaming = true
        append({ kind: 'learner', text, id: ++count }, model)
        let result
        try {
          result = await streamRun(prompt.run, { prompt: text, temperature: at.value }, {
            signal: controller.signal,
            onText(output) {
              model.text = output
              handle.update()
            },
          })
        } catch {
          model.streaming = false
          model.note = 'Stopped: you ran it again.'
          handle.update()
          return
        }
        model.streaming = false
        model.live = result.source === 'live'
        model.text = result.text || cannedOutput(prompt.examples, at.value, n)
        model.note = runNote(result)
        handle.update()
        if (!result.counted) return
      } else {
        model.id = ++count
        model.text = cannedOutput(prompt.examples, at.value, n)
        append({ kind: 'learner', text, id: ++count }, model)
      }
      ranAt.add(at.value)
      window.dispatchEvent(new CustomEvent('bits:run', { detail: { prompt: text, temperature: at.value } }))
      if (prompt.reward && !rewarded && prompt.checks.every((check) => checkPasses(check, value, ranAt))) {
        rewarded = true
        append({ kind: 'reward', id: ++count, ...prompt.reward })
        announceReward(prompt.reward)
      } else {
        handle.update()
      }
    }

    return () => {
      let { path, progress, entries, replies = DEFAULT_REPLIES, prompt, keepAppended = 6 } = handle.props
      let placeholder = handle.props.placeholder ?? prompt?.placeholder ?? 'answer, ask, or type “hint”'
      let inputId = prompt ? `${prompt.id}-terminal` : 'terminal-input'
      return (
        <section aria-label="Lesson" mix={[termStyle, handle.props.flush ? flushStyle : undefined]}>
          <div mix={titleRow}>
            <span mix={tones.volt}>bits</span>
            <span mix={pathStyle}>{path}</span>
            {progress ? <span mix={pushRight}>{progress}</span> : null}
          </div>
          <div role="log" aria-live="polite" aria-label="Session" tabIndex={0} mix={[logStyle, scrollWindowStyle, follower.mixin]}>
            {entries.map((entry, index) => (
              <TerminalEntryView
                key={`s${index}`}
                entry={entry}
                onPick={(option) =>
                  append(
                    { kind: 'learner', text: `[${option.key}] ${option.label}`, id: ++count },
                    { kind: 'tutor', body: option.reply, id: ++count },
                  )
                }
              />
            ))}
            {appended.map((entry) => (
              <TerminalEntryView key={`a${entry.id}`} entry={entry} rise />
            ))}
          </div>
          {prompt ? (
            <div mix={promptTools}>
              <ul id={`${inputId}-checks`} aria-label="Checks" mix={checkLines}>
                {prompt.checks.map((check) => {
                  let passed = hydrated && checkPasses(check, value, ranAt)
                  return (
                    <li key={check.label} data-passed={passed ? 'true' : 'false'} mix={checkLine}>
                      <span aria-hidden="true">{passed ? '✓ ' : '○ '}</span>
                      {check.label}
                      <span class="sr-only">{passed ? ', passed' : ', not yet'}</span>
                    </li>
                  )
                })}
              </ul>
              <fieldset mix={tempsRow}>
                <legend mix={tempsLegend}>run at</legend>
                {(prompt.temperatures ?? DEFAULT_TEMPS).map((option) => (
                  <label key={option.value} mix={tempChip}>
                    <input
                      type="radio"
                      name={`${inputId}-temperature`}
                      value={String(option.value)}
                      checked={option.value === temperature.value}
                      class="sr-only"
                      mix={on('change', () => {
                        temperature = option
                        window.dispatchEvent(new CustomEvent(TEMPERATURE_EVENT, { detail: option.value }))
                        handle.update()
                      })}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
          <form
            mix={[
              inputRow,
              on('submit', (event) => {
                event.preventDefault()
                let text = value.trim()
                if (!text) return
                if (prompt) {
                  void runPrompt(prompt, text)
                  return
                }
                let reply = /hint/i.test(text) ? replies.hint : replies.fallback
                value = ''
                append({ kind: 'learner', text, id: ++count }, { kind: 'tutor', body: reply, id: ++count })
              }),
            ]}
          >
            <span aria-hidden="true" mix={tones.volt}>
              ›
            </span>
            <label class="sr-only" for={inputId}>
              {prompt ? prompt.label : 'Answer or ask the tutor'}
            </label>
            <input
              id={inputId}
              autocomplete="off"
              placeholder={placeholder}
              value={value}
              aria-describedby={prompt ? `${inputId}-checks` : undefined}
              aria-keyshortcuts={prompt ? 'Enter' : undefined}
              mix={[
                inputStyle,
                on('input', (event) => {
                  value = event.currentTarget.value
                  if (!prompt) return
                  writeDraft(persist(prompt), value)
                  handle.update()
                }),
              ]}
            />
            <span aria-hidden="true" mix={enterHint}>
              ↵
            </span>
            {prompt ? submitFieldInputs(prompt.submit, value) : null}
          </form>
          {/* The note keeps its line once hydrated (as the keyboard hint), so nothing moves. */}
          {prompt ? <p mix={noJsStyle}>{hydrated ? 'Enter runs your prompt' : 'Turn on JavaScript to run prompts.'}</p> : null}
        </section>
      )
    }
  },
)

function TerminalEntryView(
  handle: Handle<{ entry: AppendedEntry | TerminalEntry; rise?: boolean; onPick?: (option: TerminalQuizOption) => void }>,
) {
  return () => {
    let { entry, rise, onPick } = handle.props
    let riseMix = rise ? riseStyle : undefined
    if (entry.kind === 'learner') {
      return (
        <p mix={[entryP, riseMix]}>
          <span aria-hidden="true" mix={tones.volt}>
            ›{' '}
          </span>
          <span class="sr-only">You: </span>
          <span mix={tones.text}>{entry.text}</span>
        </p>
      )
    }
    if (entry.kind === 'tutor') {
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={tones.volt}>◆ tutor</span>
          <div mix={tutorBody}>{entry.body}</div>
          {entry.pointer ? <div mix={pointerStyle}>{entry.pointer}</div> : null}
        </div>
      )
    }
    if (entry.kind === 'quiz') {
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={tones.volt}>◆ tutor</span>
          {entry.body ? <div mix={tutorBody}>{entry.body}</div> : null}
          <div role="group" aria-label="Answers" mix={quizRow}>
            {entry.options.map((option) => (
              <ToolButton key={option.key} variant="quiz" mix={on('click', () => onPick?.(option))}>
                {`[${option.key}] ${option.label}`}
              </ToolButton>
            ))}
          </div>
        </div>
      )
    }
    if (entry.kind === 'model') {
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={tones.ion}>
            <span aria-hidden="true">→ </span>
            {entry.streaming
              ? `model · T=${entry.temperature} · streaming…`
              : `${entry.live ? 'model' : 'example output'} · T=${entry.temperature}`}
          </span>
          <div aria-busy={entry.streaming ? 'true' : undefined} mix={[tutorBody, tones.text]}>
            {entry.text}
          </div>
          {/* Under the reply: it arrives when the stream ends and moves nothing above it. */}
          {entry.note ? <div mix={tones.muted}>{entry.note}</div> : null}
        </div>
      )
    }
    if (entry.kind === 'reward') {
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={tones.volt}>{`✓ all checks passed · +${entry.xp} neurons`}</span>
          <div mix={tutorBody}>{entry.message}</div>
          {entry.next ? (
            <div mix={pointerStyle}>
              <a href={entry.next.href} data-rmx-prefetch={prefetchFor(entry.next.href)} mix={nextLink}>
                {entry.next.label}
              </a>
            </div>
          ) : null}
        </div>
      )
    }
    return (
      <div mix={[tutorStyle, riseMix]}>
        <p mix={entryP}>
          <span aria-hidden="true" mix={tones.synapse}>
            ${' '}
          </span>
          <span mix={tones.text}>{entry.command}</span>
        </p>
        <TerminalOutput lines={entry.output} summary={entry.summary} />
      </div>
    )
  }
}

/** The bordered command-output box inside the log. Static. */
export function TerminalOutput(handle: Handle<{ lines: TerminalPart[][]; summary?: string }>) {
  return () => (
    // Wide output scrolls sideways, so the box takes focus for keyboard scrolling (decision 031).
    <div role="region" aria-label="Command output" tabIndex={0} mix={outputBox}>
      {handle.props.lines.map((line, index) => (
        <div key={index} mix={preLine}>
          {line.map(([tone, text], i) => (
            <span key={i} mix={tones[tone]}>
              {text}
            </span>
          ))}
        </div>
      ))}
      {handle.props.summary ? <div mix={summaryStyle}>{handle.props.summary}</div> : null}
    </div>
  )
}

export interface OutputPanelProps {
  command: string
  /** Scripted output lines. */
  lines: TerminalPart[][]
  /** No outer border: a ruled parent draws the cell's hairlines (decision 047). */
  flush?: boolean
}

/**
 * `:::terminal` block (components §10.16): Run replays the scripted output
 * line by line (120ms a line; instant under reduced motion). The full output
 * is server-rendered for JS-off readers. Client entry.
 */
export const OutputPanel = clientEntry(
  import.meta.url,
  function OutputPanel(handle: Handle<OutputPanelProps>) {
    let shown = handle.props.lines.length
    let running = false
    let body: HTMLElement | undefined

    // Keep the newest replayed line in view inside the panel (never the page).
    function revealLast() {
      let last = body?.querySelector<HTMLElement>('[data-live] > :last-child')
      if (!body || !last) return
      let below = last.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom
      if (below > 0) body.scrollTop += below
    }

    async function replay() {
      if (running) return
      running = true
      shown = 0
      let signal = await handle.update()
      if (body) body.scrollTop = 0
      let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      for (let i = 1; i <= handle.props.lines.length; i++) {
        if (!reduced) await new Promise((resolve) => setTimeout(resolve, 120))
        if (signal.aborted || handle.signal.aborted) return
        shown = i
        await handle.update()
        revealLast()
      }
      running = false
      handle.update()
    }

    return () => {
      let { command, lines } = handle.props
      return (
        <div mix={[panelStyle, handle.props.flush ? flushStyle : undefined]}>
          <div mix={panelHeader}>
            <span>OUTPUT</span>
            <Keycap size="sm" disabled={running} mix={on('click', () => void replay())}>
              ▶ Run
            </Keycap>
          </div>
          {/* The full output is a Ghost under the replay, so the panel is its
           * final size from the start; past --output-panel-height it scrolls. */}
          <div tabIndex={0} aria-label={`Output of ${command}`} role="region" mix={[panelBody, scrollWindowStyle, ref((node) => (body = node as HTMLElement))]}>
            <div mix={stackStyle}>
              <div aria-live="polite" data-live="">
                <CommandLine command={command} />
                <OutputLines lines={lines.slice(0, shown)} />
              </div>
              {shown < lines.length ? (
                <Ghost>
                  <CommandLine command={command} />
                  <OutputLines lines={lines} />
                </Ghost>
              ) : null}
            </div>
          </div>
        </div>
      )
    }
  },
)

function CommandLine(handle: Handle<{ command: string }>) {
  return () => (
    <div mix={preLine}>
      <span aria-hidden="true" mix={tones.synapse}>
        ${' '}
      </span>
      <span mix={tones.text}>{handle.props.command}</span>
    </div>
  )
}

function OutputLines(handle: Handle<{ lines: TerminalPart[][] }>) {
  return () => (
    <>
      {handle.props.lines.map((line, index) => (
        <div key={index} mix={preLine}>
          {line.map(([tone, text], i) => (
            <span key={i} mix={tones[tone]}>
              {text}
            </span>
          ))}
        </div>
      ))}
    </>
  )
}

const tones: Record<TerminalTone, ReturnType<typeof css>> = {
  text: css({ color: 'var(--text)' }),
  muted: css({ color: 'var(--muted)' }),
  quiet: css({ color: 'var(--text-quiet)' }),
  ion: css({ color: 'var(--ion)' }),
  volt: css({ color: 'var(--volt)' }),
  synapse: css({ color: 'var(--synapse)' }),
}

const termStyle = css({
  flex: '1 1 460px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--terminal)',
  border: 'var(--border-w) solid var(--line-glass)',
  overflow: 'hidden',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  lineHeight: 1.7,
  // Fixed size: the log inside scrolls (decision 023).
  height: 'var(--terminal-height)',
  transition: 'border-color var(--duration-focus)',
  '&:focus-within': { borderColor: 'var(--volt-a55)' },
})
// One line at every width (the path truncates): a wrapped title row took a
// second line from the log on phones (decision 025).
const titleRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  whiteSpace: 'nowrap',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const pathStyle = css({ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' })
const pushRight = css({ marginLeft: 'auto', flexShrink: 0 })
const logStyle = css({
  flex: 1,
  minHeight: 0,
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  padding: 'var(--space-5) var(--space-5) var(--space-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4_5)',
  color: 'var(--text-quiet)',
  '@media (max-width: 480px)': { padding: 'var(--space-4) var(--space-3_5) var(--space-2)' },
})
const entryP = css({ margin: 0, overflowWrap: 'anywhere' })
const tutorStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-1_5)', minWidth: 0 })
const tutorBody = css({
  paddingLeft: 'var(--space-4_5)',
  whiteSpace: 'pre-wrap',
  color: 'var(--text-body)',
  '& code': { color: 'var(--ion)', fontFamily: 'inherit' },
  '& mark': {
    color: 'var(--text)',
    background: 'var(--volt-a14)',
    padding: '0 var(--space-1)',
    borderRadius: 'var(--radius-4)',
    // Forced colours keep the tint's alpha on the Mark colour: unreadable. Paint it solid.
    [FORCED_COLORS]: forcedMark,
  },
})
const pointerStyle = css({ paddingLeft: 'var(--space-4_5)', color: 'var(--muted)', '& strong': { color: 'var(--text)', fontWeight: 400 } })
const riseStyle = css({
  animation: 'bits-rise var(--duration-sigil) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
const outputBox = css({
  marginLeft: 'var(--space-4_5)',
  padding: 'var(--space-3) var(--space-3_5)',
  borderRadius: 'var(--radius-10)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--line-hair)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0_5)',
  fontSize: 'var(--fs-13)',
  overflowX: 'auto',
  // Long lines scroll inside the box: containment keeps them out of the
  // column's min-content, so they never widen the page on a phone.
  minWidth: 0,
  contain: 'inline-size',
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
  '@media (max-width: 480px)': { marginLeft: 0 },
})
const preLine = css({ whiteSpace: 'pre' })
const summaryStyle = css({ marginTop: 'var(--space-1_5)', color: 'var(--muted)' })
const inputRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  margin: 'var(--space-3)',
  padding: '0 var(--space-2) 0 var(--space-3_5)',
  borderRadius: 'var(--radius-12)',
  background: 'var(--surface)',
  border: 'var(--border-w) solid var(--volt-a35)',
  // Flat focus: the border goes volt and thickens to 2px, inside the box.
  '&:focus-within': { borderColor: 'var(--volt)', boxShadow: 'inset 0 0 0 var(--border-w) var(--volt)' },
})
const inputStyle = css({
  flex: 1,
  minWidth: 0,
  height: '50px',
  background: 'transparent',
  border: 0,
  outline: 'none',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-14)',
  '&::placeholder': { color: 'var(--dim)' },
})
const enterHint = css({ fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const quizRow = css({ paddingLeft: 'var(--space-4_5)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' })
const nextLink = css({ color: 'var(--volt)' })
const promptTools = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-5) 0',
  borderTop: 'var(--border-w) solid var(--line-bar)',
  fontSize: 'var(--fs-13)',
  '@media (max-width: 480px)': { padding: 'var(--space-3) var(--space-3_5) 0' },
})
// Phones: smaller and tighter, so short checks share a line and the log
// keeps the room (decision 025).
const checkLines = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: 'var(--space-5)',
  rowGap: 'var(--space-1)',
  '@media (max-width: 480px)': { fontSize: 'var(--fs-12)', columnGap: 'var(--space-4)', rowGap: 0 },
})
const checkLine = css({
  color: 'var(--muted)',
  transition: 'color var(--duration-focus)',
  '&[data-passed="true"]': { color: 'var(--volt-soft)' },
})
const tempsRow = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap' })
const tempsLegend = css({ float: 'left', padding: 0, marginRight: 'var(--space-2)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const tempChip = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  minWidth: '48px',
  padding: '0 var(--space-2_5)',
  border: 'var(--border-w) solid var(--line-control)',
  color: 'var(--text-quiet)',
  cursor: 'pointer',
  // One segmented control: the chips share their hairlines.
  '& + &': { marginLeft: 'calc(-1 * var(--border-w))' },
  '&::before': { content: '""', position: 'absolute', inset: '-4px 0' },
  '&:hover': { zIndex: 1, borderColor: 'var(--line-node-next)', background: 'var(--fill-hover)' },
  '&:has(:checked)': { zIndex: 1, background: 'var(--ion-a16)', borderColor: 'var(--ion)', color: 'var(--text)' },
  '&:has(:focus-visible)': { ...focusOutline, zIndex: 2 },
  [FORCED_COLORS]: { '&:has(:checked)': forcedSelected },
})
const noJsStyle = css({ margin: '0 var(--space-4) var(--space-3)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })

const panelStyle = css({
  borderRadius: 'var(--radius-xl)',
  background: 'var(--terminal)',
  border: 'var(--border-w) solid var(--line-glass)',
  overflow: 'hidden',
  // As wide as its column, never wider: long commands and output lines
  // scroll inside the body instead of widening the page (see outputBox).
  minWidth: 0,
  contain: 'inline-size',
})
/** A cell of a ruled parent: the parent's hairlines are its edges. */
const flushStyle = css({ border: 0, '&:focus-within': { boxShadow: 'inset 0 0 0 var(--border-w) var(--volt-a55)' } })
const panelHeader = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  padding: 'var(--space-2_5) var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line-bar)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  color: 'var(--muted)',
})
const panelBody = css({
  padding: 'var(--space-3_5) var(--space-4)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  lineHeight: 1.8,
  color: 'var(--text-quiet)',
  overflowX: 'auto',
  minHeight: '120px',
  maxHeight: 'var(--output-panel-height)',
  '&:focus-visible': { outlineOffset: 'var(--focus-offset-inset)' },
})
