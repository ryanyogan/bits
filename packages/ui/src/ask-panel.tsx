import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { CheckChip, checkListStyle } from './check-chip.tsx'
import { SuggestionChip } from './chip.tsx'
import { Keycap } from './keycap.tsx'
import {
  announceGate,
  postAnswer,
  verdictXpLabel,
  type AskEndpoint,
  type AskVerdict,
} from './lib/ask-client.ts'
import { FOCUS_WITHIN, FORCED_COLORS } from './lib/states.ts'
import { announceReward } from './reward-toast.tsx'
import { toyHeaderStyle, toyLabelStyle, toyPanelStyle } from './toy-panel.tsx'
import { LearnerBubble, TutorMessage } from './tutor.tsx'

export interface AskChoiceOption {
  key: string
  label: string
}

export interface AskPanelProps {
  /** The ask's id: the panel is `#ask-<id>` and its fields take it. */
  id: string
  /** The question, as plain elements (`<strong>`, `<code>`, links). */
  question: RemixNode
  placeholder?: string
  /** Options: chips that fill the field (a typed letter or option text counts too). */
  choices?: AskChoiceOption[]
  /** Several options are right: chips toggle letters ("a, c") instead of filling the text. */
  multiple?: boolean
  /** Neurons a right answer is worth (shown in the strip). */
  xp: number
  /**
   * Where answers are graded (`/api/ask`). The panel is also a native form
   * posting to it, so it works before hydration and without JS (the server
   * redirects back with the verdict). Absent: the author preview, which
   * can't grade.
   */
  endpoint?: AskEndpoint
  /** A verdict the server already gave (a native answer, flashed back). */
  initial?: AskVerdict
  /** Answered right before (this browser's session). */
  passed?: boolean
  /** Mono label in the strip (default "quick check"). */
  label?: string
}

interface Entry {
  id: number
  answer: string
  verdict?: AskVerdict
  /** The request failed: shown instead of a verdict. */
  error?: string
}

/**
 * A quick check in the prompt window (decision 052): the question as a
 * tutor turn, a single-line field that grows, option chips that fill it,
 * and a Check key. The server grades each answer (`/api/ask`); the verdict
 * lands in the log with ✓/✗, the check chips and the explanation or hint.
 * Retrying is fine. A right answer opens the lesson's gate (`bits:gate`)
 * and, when it earned neurons, fires `bits:reward` with the server's xp.
 * Enter checks, Shift+Enter adds a line. Client entry.
 */
export const AskPanel = clientEntry(
  import.meta.url,
  function AskPanel(handle: Handle<AskPanelProps>) {
    let hydrated = false
    let value = ''
    let count = 0
    let entries: Entry[] = handle.props.initial ? [{ id: ++count, answer: handle.props.initial.answer, verdict: handle.props.initial }] : []
    let passed = Boolean(handle.props.passed || handle.props.initial?.correct)
    let pending = false
    let field: HTMLTextAreaElement | undefined
    let inflight: AbortController | undefined
    handle.signal.addEventListener('abort', () => inflight?.abort())

    handle.queueTask(() => {
      hydrated = true
      // A right answer the server flashed back still opens the gate.
      if (handle.props.initial?.correct) announceGate(handle.props.id)
      handle.update()
    })

    function grow() {
      if (!field) return
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    }

    function setValue(next: string) {
      value = next
      handle.update().then(grow)
    }

    function pick(choice: AskChoiceOption) {
      if (!handle.props.multiple) {
        setValue(choice.label)
      } else {
        let keys = picked()
        keys = keys.includes(choice.key) ? keys.filter((key) => key !== choice.key) : [...keys, choice.key].sort()
        setValue(keys.join(', '))
      }
      field?.focus()
    }

    /** Letters in the field (multiple asks): "a, c" → ["a", "c"]. */
    function picked(): string[] {
      return value
        .split(/[,;\s]+/)
        .map((part) => part.trim().toLowerCase())
        .filter((part) => /^[a-z]$/.test(part))
    }

    async function check() {
      let endpoint = handle.props.endpoint
      let answer = value.trim()
      if (!endpoint || !answer || pending) return
      pending = true
      let entry: Entry = { id: ++count, answer }
      entries = [...entries, entry].slice(-3)
      handle.update()
      inflight?.abort()
      let controller = (inflight = new AbortController())
      let result
      try {
        result = await postAnswer(endpoint, answer, controller.signal)
      } catch {
        return
      } finally {
        if (inflight === controller) inflight = undefined
        pending = false
      }
      if (result.ok) {
        entry.verdict = result.verdict
        if (result.verdict.correct) {
          passed = true
          announceGate(handle.props.id)
          if (result.verdict.xp > 0) {
            announceReward({ xp: result.verdict.xp, message: result.verdict.feedback, source: 'ask' })
          }
          value = ''
        }
      } else {
        entry.error = result.message
      }
      await handle.update()
      grow()
      // Back to the field for the next try, without moving the page (decision 020).
      field?.focus({ preventScroll: true })
    }

    return () => {
      let { id, question, placeholder = 'Type your answer…', choices = [], multiple, xp, endpoint, label = 'quick check' } = handle.props
      let base = `ask-${id}`
      let fieldId = `${base}-answer`
      let questionId = `${base}-question`
      let keys = multiple ? picked() : []
      let live = Boolean(endpoint)
      return (
        <form
          id={base}
          method="post"
          action={endpoint?.action}
          // A native answer comes back as this same lesson: keep focus, the
          // scroll and the history where they are (as the quiz card did).
          data-rmx-reset-focus="manual"
          data-rmx-reset-scroll="manual"
          data-rmx-history="replace"
          mix={[
            toyPanelStyle,
            wrapStyle,
            on('submit', (event) => {
              if (!hydrated) return
              event.preventDefault()
              void check()
            }),
          ]}
        >
          <div mix={[toyHeaderStyle, headerStyle]}>
            <span mix={[toyLabelStyle, labelTone]}>{label}</span>
            <span mix={xpStyle}>{passed ? '✓ answered' : xp > 0 ? `+${xp} neurons` : ''}</span>
          </div>
          <div mix={logStyle}>
            <TutorMessage mix={questionStyle}>
              <p id={questionId}>{question}</p>
            </TutorMessage>
            {/* Mounted empty, so each verdict is announced as it lands (decision 031). */}
            <ol aria-live="polite" aria-label="Your answers" mix={entriesStyle}>
              {entries.map((entry) => (
                <li key={entry.id} mix={entryStyle}>
                  <LearnerBubble>{entry.answer}</LearnerBubble>
                  {entry.verdict ? (
                    <VerdictBubble verdict={entry.verdict} choices={choices} />
                  ) : entry.error ? (
                    <p mix={[verdictStyle, errorStyle]}>{entry.error}</p>
                  ) : (
                    <p aria-busy="true" mix={[verdictStyle, checkingStyle]}>
                      Checking…
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div mix={composerStyle}>
            {choices.length ? (
              <div role="group" aria-label={multiple ? 'Options (pick every one that fits)' : 'Options'} mix={chipsStyle}>
                {choices.map((choice) => (
                  <SuggestionChip
                    key={choice.key}
                    // Before hydration a chip submits its option as the answer.
                    type={hydrated ? 'button' : 'submit'}
                    name={endpoint?.answerField}
                    value={choice.key}
                    pressed={multiple ? keys.includes(choice.key) : undefined}
                    mix={on('click', (event) => {
                      if (!hydrated) return
                      event.preventDefault()
                      pick(choice)
                    })}
                  >
                    <span aria-hidden="true" mix={keyStyle}>
                      {choice.key}
                    </span>
                    {choice.label}
                  </SuggestionChip>
                ))}
              </div>
            ) : null}
            <div mix={fieldRow}>
              <span aria-hidden="true" mix={promptGlyph}>
                ›
              </span>
              <textarea
                id={fieldId}
                name={endpoint?.answerField}
                rows={1}
                placeholder={placeholder}
                value={value}
                disabled={!live}
                autocomplete="off"
                aria-labelledby={questionId}
                aria-keyshortcuts="Enter"
                mix={[
                  fieldStyle,
                  ref((node) => (field = node)),
                  on('input', (event) => {
                    value = event.currentTarget.value
                    grow()
                    handle.update()
                  }),
                  on('keydown', (event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }),
                ]}
              />
              <Keycap type="submit" size="md" disabled={!live} loading={pending} mix={checkKeyStyle}>
                Check ↵
              </Keycap>
            </div>
            <p mix={hintStyle}>
              {!live
                ? 'Answers are checked on the published lesson.'
                : choices.length
                  ? multiple
                    ? 'Tap every option that fits, or type their letters · Enter checks'
                    : 'Type your answer or tap an option · Enter checks'
                  : 'Enter checks · Shift+Enter adds a line'}
            </p>
            {endpoint
              ? Object.entries(endpoint.fields).map(([name, fieldValue]) => (
                  <input key={name} type="hidden" name={name} value={fieldValue} />
                ))
              : null}
          </div>
        </form>
      )
    }
  },
)

/** The server's verdict on one answer: ✓/✗, the neurons, the checks, the feedback. */
function VerdictBubble(handle: Handle<{ verdict: AskVerdict; choices: AskChoiceOption[] }>) {
  return () => {
    let { verdict, choices } = handle.props
    let xpLabel = verdictXpLabel(verdict)
    let picks = verdict.picks
      .map((pick) => ({ ...pick, label: choices.find((choice) => choice.key === pick.key)?.label }))
      .filter((pick) => pick.label)
    return (
      <div data-correct={verdict.correct ? 'true' : 'false'} mix={[verdictStyle, verdict.correct ? rightStyle : wrongStyle]}>
        <p mix={verdictHead}>
          <span aria-hidden="true">{verdict.correct ? '✓ ' : '✗ '}</span>
          {verdict.correct ? 'Right' : 'Not quite'}
          {xpLabel ? <span mix={verdictXp}>{` · ${xpLabel}`}</span> : null}
        </p>
        {verdict.checks.length || picks.length > 1 ? (
          <ul aria-label="Checks" mix={checkListStyle}>
            {picks.length > 1
              ? picks.map((pick) => (
                  <CheckChip key={`pick-${pick.key}`} passed={pick.correct} compact>
                    {`${pick.key} ${pick.correct ? 'fits' : 'doesn’t fit'}`}
                  </CheckChip>
                ))
              : null}
            {verdict.checks.map((check) => (
              <CheckChip key={`${check.kind}-${check.label}`} passed={check.passed} compact>
                {check.kind === 'reject' ? `✗ ${check.label}` : check.label}
              </CheckChip>
            ))}
          </ul>
        ) : null}
        <p mix={feedbackStyle}>{verdict.feedback}</p>
      </div>
    )
  }
}

// The prompt window's frame (as the PromptComposer's): a well with the volt
// "your turn" hairline, the question and answers above the field.
const wrapStyle = css({ background: 'var(--well)', borderColor: 'var(--volt-a40)', scrollMarginTop: 'calc(var(--shell-h, 0px) + var(--space-4))' })
const headerStyle = css({ paddingInline: 'var(--space-4)', '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' } })
const labelTone = css({ color: 'var(--synapse)' })
const xpStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--volt-soft)' })
const logStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-4)',
  background: 'var(--surface)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const questionStyle = css({ '& p': { color: 'var(--text)' } })
const entriesStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  '&:empty': { display: 'contents' },
})
const entryStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  animation: 'bits-rise var(--duration-sigil) var(--ease) both',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})
// A flat panel under the answer, attached to the tutor's column like a reply.
const verdictStyle = css({
  margin: 0,
  marginLeft: '46px',
  padding: 'var(--space-3) var(--space-4)',
  border: 'var(--border-w) solid var(--line-panel)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.55,
  color: 'var(--text-body)',
  '@media (max-width: 480px)': { marginLeft: 0 },
})
const rightStyle = css({
  borderColor: 'var(--volt-a45)',
  background: 'var(--volt-tint-on)',
  boxShadow: 'inset 2px 0 0 var(--volt)',
  [FORCED_COLORS]: { borderLeftWidth: '3px' },
})
const wrongStyle = css({
  borderColor: 'var(--warn-line)',
  background: 'var(--warn-tint)',
  boxShadow: 'inset 2px 0 0 var(--warn)',
  [FORCED_COLORS]: { borderLeftWidth: '3px' },
})
const errorStyle = css({ color: 'var(--warn)', fontSize: 'var(--fs-14)' })
const checkingStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--muted)' })
const verdictHead = css({
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  color: 'var(--text)',
  '[data-correct="true"] > &': { color: 'var(--volt-soft)' },
  '[data-correct="false"] > &': { color: 'var(--warn)' },
})
const verdictXp = css({ color: 'var(--volt-soft)' })
const feedbackStyle = css({ margin: 0 })

const composerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  transition: 'box-shadow var(--duration-focus)',
  // Flat focus, as the composer: a 2px ring drawn inside the field's cell.
  [FOCUS_WITHIN]: { boxShadow: 'inset 0 0 0 var(--focus-outline-w) var(--focus-ring-color)' },
  '@media (max-width: 480px)': { padding: 'var(--space-3_5) var(--space-3)' },
})
const chipsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' })
const keyStyle = css({ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--muted)' })
const fieldRow = css({ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const promptGlyph = css({
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.6,
  paddingTop: 'var(--space-2_5)',
  color: 'var(--volt)',
})
// Single line that grows with the answer: mono 16px, as the composer's field.
const fieldStyle = css({
  flex: '1 1 12rem',
  minWidth: 0,
  minHeight: 'var(--control-field)',
  boxSizing: 'border-box',
  padding: 'var(--space-2_5) 0',
  resize: 'none',
  overflow: 'hidden',
  background: 'transparent',
  border: 0,
  color: 'var(--text)',
  caretColor: 'var(--volt)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.6,
  outline: 'none',
  // The cell shows focus (focus-within); no ring on the field itself.
  '&:focus-visible': { outline: 'none', boxShadow: 'none' },
  '&::placeholder': { color: 'var(--dim)' },
  '&:disabled': { cursor: 'not-allowed' },
})
const checkKeyStyle = css({ minWidth: '8em', '@media (max-width: 360px)': { width: '100%' } })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
