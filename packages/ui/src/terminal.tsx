import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { Keycap } from './keycap.tsx'
import { initialTemperature, TEMPERATURE_EVENT } from './odds-bars.tsx'
import { readDraft, writeDraft, type DraftPersist } from './lib/drafts.ts'
import { fieldFrameStyle, fieldGlyphStyle, fieldInputStyle, fieldKeyedStyle } from './lib/field.ts'
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
import { announceGate, postAnswer, verdictXpLabel, type AskEndpoint, type AskVerdict } from './lib/ask-client.ts'
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
  /**
   * A quick check (`:::ask` or `:::quiz`, decision 052): the tutor's
   * question with lettered option buttons that fill the input. The input
   * answers it, and the server grades the answer.
   */
  | { kind: 'ask'; body?: RemixNode; ask: TerminalAsk }

export interface TerminalAsk {
  /** The ask's id. */
  id: string
  /** Plain text of the question: the input's label while it answers this ask. */
  label: string
  placeholder?: string
  /** Options: `[a] label` buttons that fill the input (a typed letter counts too). */
  choices: { key: string; label: string }[]
  /** Several options are right: the buttons toggle letters ("a, c"). */
  multiple?: boolean
  xp: number
  /** Where answers are graded (`/api/ask`); absent in the author preview. */
  endpoint?: AskEndpoint
  /** Answered right before (this browser's session). */
  passed?: boolean
  /** A verdict the server already gave (a native answer, flashed back). */
  initial?: AskVerdict
}

export interface TerminalReplies {
  /** The authored reply when the learner types "hint" (nothing to answer in the lesson). */
  hint: string
  /** Ignored: a canned reply to a typed answer faked a result (decision 052). */
  fallback?: string
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
  /** The reply to "hint" when there is nothing to answer (no ask pending, no prompt). */
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

/** The server's verdict on an answer (or why there isn't one yet). */
interface VerdictEntry {
  kind: 'verdict'
  id: number
  verdict?: AskVerdict
  error?: string
}

type AppendedEntry =
  | (TerminalEntry & { id: number })
  | ModelEntry
  | VerdictEntry
  | { kind: 'reward'; id: number; xp: number; message: string; next?: RewardNext }

const DEFAULT_HINT = 'Re-read the last tutor message: the answer is in there.'
/** The honest reply to free text: there is no tutor model behind this input yet. */
const NO_TUTOR = 'Nothing to answer here yet: the tutor can’t reply to free questions. Type “hint” for this lesson’s hint.'

/** What the input is answering: an ask, the prompt exercise, or nothing (hint only). */
type Target = { kind: 'ask'; ask: TerminalAsk } | { kind: 'prompt'; prompt: TerminalPrompt } | { kind: 'free' }

const DEFAULT_TEMPS: TemperatureOption[] = [
  { value: 0, label: '0' },
  { value: 70, label: '0.7' },
  { value: 100, label: '1.0' },
]

/**
 * Terminal-mode lesson (components §10.15): a `role="log"` of learner lines,
 * tutor blocks, command output and quick checks, and one input.
 * Server-rendered entries read in order with JS off. The input answers the
 * first quick check not yet answered (or the one whose option was tapped):
 * the server grades it (`/api/ask`, decision 052) and the verdict lands in
 * the log. With every check answered, it runs the `prompt` exercise (live
 * checks, server runs, reward); with neither, "hint" shows the lesson's
 * hint and nothing fakes a reply. Before hydration and without JS the input
 * is a native form that posts the answer, and the server redirects back
 * with the verdict. The panel is a fixed height (`--terminal-height`) and
 * the log scrolls inside it, like a real terminal: it opens at the top of
 * the lesson, and once the learner acts it follows new lines while they're
 * at the bottom (decision 023). Client entry.
 */
export const TerminalLog = clientEntry(
  import.meta.url,
  function TerminalLog(handle: Handle<TerminalLogProps>) {
    let appended: AppendedEntry[] = []
    let count = 0
    let value = handle.props.prompt?.persist?.saved?.value ?? handle.props.prompt?.defaultDraft ?? ''
    let hydrated = false
    let temperature = initialTemperature(handle.props.prompt?.temperatures ?? DEFAULT_TEMPS)
    let ranAt = new Set<number>()
    let runs = 0
    let rewarded = false
    // Opens at the start of the lesson; the learner's first action pins it.
    let follower = createFollower({ startPinned: false })
    let input: HTMLInputElement | undefined

    // Quick checks: which are answered, the one the learner picked to answer
    // (else the first open one), and a draft answer per check.
    let asks = () =>
      handle.props.entries.flatMap((entry) => (entry.kind === 'ask' ? [entry.ask] : []))
    let passed = new Set(asks().filter((ask) => ask.passed || ask.initial?.correct).map((ask) => ask.id))
    let chosen: string | undefined
    let answers: Record<string, string> = {}
    let checking = false
    for (let ask of asks()) {
      if (!ask.initial) continue
      appended.push(
        { kind: 'learner', text: ask.initial.answer, id: ++count },
        { kind: 'verdict', verdict: ask.initial, id: ++count },
      )
    }

    function target(): Target {
      let all = asks()
      let ask = all.find((a) => a.id === chosen) ?? all.find((a) => !passed.has(a.id))
      if (ask) return { kind: 'ask', ask }
      let prompt = handle.props.prompt
      return prompt ? { kind: 'prompt', prompt } : { kind: 'free' }
    }

    let persist = (prompt: TerminalPrompt): DraftPersist => prompt.persist ?? { id: prompt.id, key: 'prompt' }

    handle.queueTask(() => {
      let prompt = handle.props.prompt
      if (prompt) value = readDraft(persist(prompt)) ?? prompt.defaultDraft ?? ''
      hydrated = true
      // A right answer the server flashed back still opens its gate.
      for (let ask of asks()) if (ask.initial?.correct) announceGate(ask.id)
      handle.update()
    })

    function append(...entries: AppendedEntry[]) {
      appended = [...appended, ...entries].slice(-(handle.props.keepAppended ?? 6))
      follower.pin()
      handle.update()
    }

    /** An option button: answer that check next, with the option filled in (letters toggle for `multiple`). */
    function pickOption(ask: TerminalAsk, option?: { key: string; label: string }) {
      chosen = ask.id
      if (option) {
        if (!ask.multiple) {
          answers[ask.id] = option.label
        } else {
          let keys = (answers[ask.id] ?? '')
            .split(/[,;\s]+/)
            .map((part) => part.trim().toLowerCase())
            .filter((part) => /^[a-z]$/.test(part))
          keys = keys.includes(option.key) ? keys.filter((key) => key !== option.key) : [...keys, option.key].sort()
          answers[ask.id] = keys.join(', ')
        }
      }
      handle.update()
      input?.focus()
    }

    async function answerAsk(ask: TerminalAsk, text: string) {
      if (!ask.endpoint || checking) return
      checking = true
      let entry: VerdictEntry = { kind: 'verdict', id: 0 }
      entry.id = ++count
      append({ kind: 'learner', text, id: ++count }, entry)
      let result = await postAnswer(ask.endpoint, text).catch(() => undefined)
      checking = false
      if (!result) return
      if (!result.ok) {
        entry.error = result.message
      } else {
        entry.verdict = result.verdict
        if (result.verdict.correct) {
          passed.add(ask.id)
          answers[ask.id] = ''
          if (chosen === ask.id) chosen = undefined
          announceGate(ask.id)
          if (result.verdict.xp > 0) announceReward({ xp: result.verdict.xp, message: result.verdict.feedback, source: 'ask' })
        }
      }
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

    let free = ''

    function submit() {
      let goal = target()
      if (goal.kind === 'ask') {
        let text = (answers[goal.ask.id] ?? '').trim()
        if (text) void answerAsk(goal.ask, text)
        return
      }
      if (goal.kind === 'prompt') {
        let text = value.trim()
        if (text) void runPrompt(goal.prompt, text)
        return
      }
      let text = free.trim()
      if (!text) return
      free = ''
      // No tutor model answers free text yet: only the authored hint, never a canned verdict.
      let reply = /hint/i.test(text) ? (handle.props.replies?.hint ?? DEFAULT_HINT) : NO_TUTOR
      append({ kind: 'learner', text, id: ++count }, { kind: 'tutor', body: reply, id: ++count })
    }

    return () => {
      let { path, progress, entries } = handle.props
      let goal = target()
      let ask = goal.kind === 'ask' ? goal.ask : undefined
      let prompt = goal.kind === 'prompt' ? goal.prompt : undefined
      let placeholder = ask
        ? (ask.placeholder ?? (ask.choices.length ? 'type your answer, or pick an option above' : 'type your answer'))
        : prompt
          ? (handle.props.placeholder ?? prompt.placeholder ?? 'write your prompt')
          : 'type “hint” for a hint'
      let inputId = ask ? `ask-${ask.id}-terminal` : prompt ? `${prompt.id}-terminal` : 'terminal-input'
      let fieldValue = ask ? (answers[ask.id] ?? '') : prompt ? value : free
      let native = ask?.endpoint
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
                ask={
                  entry.kind === 'ask'
                    ? {
                        passed: passed.has(entry.ask.id),
                        active: ask?.id === entry.ask.id,
                        answer: answers[entry.ask.id] ?? '',
                        hydrated,
                        onPick: (option) => pickOption(entry.ask, option),
                      }
                    : undefined
                }
              />
            ))}
            {appended.map((entry) => (
              <TerminalEntryView key={`a${entry.id}`} entry={entry} rise />
            ))}
          </div>
          {ask ? (
            <div mix={promptTools}>
              <p id={`${inputId}-ask`} mix={askLine}>
                <span mix={tones.synapse}>? quick check</span>
                {ask.xp > 0 ? <span mix={tones.volt}>{` · +${ask.xp} neurons`}</span> : null}
                {` · ${ask.label}`}
              </p>
            </div>
          ) : null}
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
          {/* The shared field (decision 051): › prompt, mono 16px, an md key inside the frame.
           * Answering a quick check, the input is also a native form to
           * /api/ask (works before hydration and without JS; the server
           * redirects back with the verdict, keeping focus and scroll). */}
          <form
            id={native ? `ask-${ask!.id}` : undefined}
            method={native ? 'post' : undefined}
            action={native?.action}
            data-rmx-reset-focus={native ? 'manual' : undefined}
            data-rmx-reset-scroll={native ? 'manual' : undefined}
            data-rmx-history={native ? 'replace' : undefined}
            mix={[
              fieldFrameStyle,
              fieldKeyedStyle,
              inputRow,
              on('submit', (event) => {
                event.preventDefault()
                submit()
              }),
            ]}
          >
            <span aria-hidden="true" mix={fieldGlyphStyle}>
              ›
            </span>
            <label class="sr-only" for={inputId}>
              {ask ? `Your answer: ${ask.label}` : prompt ? prompt.label : 'Type “hint” for a hint'}
            </label>
            <input
              id={inputId}
              name={native?.answerField}
              autocomplete="off"
              placeholder={placeholder}
              value={fieldValue}
              aria-describedby={ask ? `${inputId}-ask` : prompt ? `${inputId}-checks` : undefined}
              aria-keyshortcuts={ask || prompt ? 'Enter' : undefined}
              mix={[
                fieldInputStyle,
                ref((node) => (input = node)),
                on('input', (event) => {
                  let next = event.currentTarget.value
                  let goal = target()
                  if (goal.kind === 'ask') answers[goal.ask.id] = next
                  else if (goal.kind === 'free') free = next
                  else {
                    value = next
                    writeDraft(persist(goal.prompt), value)
                  }
                  handle.update()
                }),
              ]}
            />
            <Keycap type="submit" size="md" disabled={!hydrated && !native} loading={checking} mix={sendKeyStyle}>
              {prompt ? 'Run ↵' : ask ? 'Check ↵' : 'Send ↵'}
            </Keycap>
            {native
              ? Object.entries(native.fields).map(([name, fieldValue]) => <input key={name} type="hidden" name={name} value={fieldValue} />)
              : null}
            {prompt ? submitFieldInputs(prompt.submit, value) : null}
          </form>
          {/* The note keeps its line once hydrated (as the keyboard hint), so nothing moves. */}
          {ask ? (
            <p mix={noJsStyle}>{ask.endpoint ? 'Enter checks your answer' : 'Answers are checked on the published lesson.'}</p>
          ) : prompt ? (
            <p mix={noJsStyle}>{hydrated ? 'Enter runs your prompt' : 'Turn on JavaScript to run prompts.'}</p>
          ) : null}
        </section>
      )
    }
  },
)

/** An ask entry's state, from the log. */
interface AskEntryState {
  passed: boolean
  /** The input answers this one now. */
  active: boolean
  /** Its draft answer (option letters for a `multiple` ask). */
  answer: string
  hydrated: boolean
  onPick: (option?: { key: string; label: string }) => void
}

function TerminalEntryView(handle: Handle<{ entry: AppendedEntry | TerminalEntry; rise?: boolean; ask?: AskEntryState }>) {
  return () => {
    let { entry, rise, ask: state } = handle.props
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
    if (entry.kind === 'ask') {
      let { ask } = entry
      let keys = ask.multiple ? state?.answer.split(/[,;\s]+/).map((part) => part.toLowerCase()) ?? [] : []
      return (
        <div id={`ask-${ask.id}-entry`} mix={[tutorStyle, riseMix]}>
          <span mix={tones.volt}>
            ◆ tutor <span mix={tones.synapse}>· quick check</span>
          </span>
          {entry.body ? <div mix={tutorBody}>{entry.body}</div> : null}
          {ask.choices.length ? (
            <div role="group" aria-label={ask.multiple ? 'Options (pick every one that fits)' : 'Options'} mix={quizRow}>
              {ask.choices.map((option) => (
                <ToolButton
                  key={option.key}
                  variant="quiz"
                  disabled={!state?.hydrated}
                  pressed={ask.multiple ? keys.includes(option.key) : undefined}
                  mix={[optionWrap, on('click', () => state?.onPick(option))]}
                >
                  {`[${option.key}] ${option.label}`}
                </ToolButton>
              ))}
            </div>
          ) : null}
          <div mix={pointerStyle}>
            {state?.passed ? (
              <span mix={tones.volt}>✓ answered</span>
            ) : state?.active ? (
              '↓ answer below'
            ) : state?.hydrated ? (
              <ToolButton variant="quiz" mix={on('click', () => state.onPick())}>
                answer this ↓
              </ToolButton>
            ) : (
              'answer after the checks above'
            )}
          </div>
        </div>
      )
    }
    if (entry.kind === 'verdict') {
      let { verdict, error } = entry
      if (!verdict) {
        return (
          <p aria-busy={error ? undefined : 'true'} mix={[entryP, riseMix, error ? warnTone : tones.muted]}>
            {error ?? 'checking…'}
          </p>
        )
      }
      let xpLabel = verdictXpLabel(verdict)
      return (
        <div mix={[tutorStyle, riseMix]}>
          <span mix={verdict.correct ? tones.volt : warnTone}>
            {verdict.correct ? '✓ right' : '✗ not quite'}
            {xpLabel ? ` · ${xpLabel}` : ''}
          </span>
          {verdict.checks.length ? (
            <ul aria-label="Checks" mix={[checkLines, verdictChecks]}>
              {verdict.checks.map((check) => (
                <li key={`${check.kind}-${check.label}`} data-passed={check.passed ? 'true' : 'false'} mix={checkLine}>
                  <span aria-hidden="true">{check.kind === 'reject' ? '✗ ' : check.passed ? '✓ ' : '○ '}</span>
                  {check.label}
                  <span class="sr-only">{check.kind === 'reject' ? ', matched: not this' : check.passed ? ', passed' : ', not yet'}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div mix={tutorBody}>{verdict.feedback}</div>
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
    // A group, not a region: a log can hold several, and landmarks must have unique names.
    <div role="group" aria-label="Command output" tabIndex={0} mix={outputBox}>
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
           * final size from the start; past --output-panel-height it scrolls.
           * A group, not a region: a lesson can run the same command twice,
           * and two regions with one name fail axe's landmark-unique. */}
          <div tabIndex={0} aria-label={`Output of ${command}`} role="group" mix={[panelBody, scrollWindowStyle, ref((node) => (body = node as HTMLElement))]}>
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
// The shared field (decision 051) sits in the panel's last row.
const inputRow = css({ margin: 'var(--space-3)' })
const sendKeyStyle = css({ flex: 'none' })
const quizRow = css({ paddingLeft: 'var(--space-4_5)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' })
const warnTone = css({ color: 'var(--warn)' })
const askLine = css({ margin: 0, color: 'var(--text-quiet)', overflowWrap: 'anywhere' })
// Long options wrap inside the log instead of running past it on a phone.
const optionWrap = css({
  maxWidth: '100%',
  height: 'auto',
  paddingBlock: 'var(--space-2)',
  whiteSpace: 'normal',
  textAlign: 'start',
  overflowWrap: 'anywhere',
})
const verdictChecks = css({ paddingLeft: 'var(--space-4_5)' })
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
