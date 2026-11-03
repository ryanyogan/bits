import type { Handle, RemixNode } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { CheckChip, checkListStyle } from './check-chip.tsx'
import { Keycap } from './keycap.tsx'
import {
  announceGate,
  postAnswer,
  verdictXpLabel,
  type AskEndpoint,
  type AskVerdict,
} from './lib/ask-client.ts'
import {
  fieldFrameStyle,
  fieldGlyphStyle,
  fieldGlyphTopStyle,
  fieldInputStyle,
  fieldKeyedStyle,
} from './lib/field.ts'
import { FORCED_COLORS } from './lib/states.ts'
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
  /**
   * Options: a real radio group (or checkboxes with `multiple`) instead of
   * the text field (decision 067). Select, then Check.
   */
  choices?: AskChoiceOption[]
  /** Several options are right: checkboxes, sent as their letters ("a, c"). */
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
  /** What the learner sees in their bubble (option labels for a choice). */
  answer: string
  verdict?: AskVerdict
  /** The request failed: shown instead of a verdict. */
  error?: string
}

/**
 * A quick check in the prompt window (decision 052): the question as a
 * tutor turn, then either a single-line field that grows or, for options, a
 * real radio group / checkbox list (decision 067), and a Check key. The server grades each answer (`/api/ask`); the verdict
 * lands in the log with ✓/✗, the check chips and the explanation or hint.
 * Retrying is fine. A right answer opens the lesson's gate (`bits:gate`)
 * and, when it earned neurons, fires `bits:reward` with the server's xp;
 * the panel then folds its answer controls away ("Answer again" reopens
 * them). In the text field, Enter checks and Shift+Enter adds a line.
 * Client entry.
 */
export const AskPanel = clientEntry(
  import.meta.url,
  function AskPanel(handle: Handle<AskPanelProps>) {
    let hydrated = false
    let value = ''
    let count = 0
    let entries: Entry[] = handle.props.initial ? [{ id: ++count, answer: handle.props.initial.answer, verdict: handle.props.initial }] : []
    let passed = Boolean(handle.props.passed || handle.props.initial?.correct)
    /** Answer controls shown again after a right answer. */
    let reopened = false
    /** Option keys picked (choice asks). */
    let selected: string[] = []
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

    function select(key: string, on: boolean) {
      if (!handle.props.multiple) selected = on ? [key] : []
      else selected = on ? [...new Set([...selected, key])].sort() : selected.filter((k) => k !== key)
      handle.update()
    }

    /** What's sent, and what the learner's bubble shows. */
    function answerOf(): { sent: string; shown: string } {
      let choices = handle.props.choices ?? []
      if (!choices.length) return { sent: value.trim(), shown: value.trim() }
      let labels = selected.map((key) => choices.find((choice) => choice.key === key)?.label ?? key)
      return { sent: selected.join(', '), shown: labels.join(' · ') }
    }

    async function check() {
      let endpoint = handle.props.endpoint
      let { sent: answer, shown } = answerOf()
      if (!endpoint || !answer || pending) return
      pending = true
      let entry: Entry = { id: ++count, answer: shown }
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
          reopened = false
          selected = []
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
      let live = Boolean(endpoint)
      let folded = passed && !reopened && !pending
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
          {folded ? (
            <div mix={foldedStyle}>
              <p mix={foldedText}>
                <span aria-hidden="true">✓ </span>
                {entries.length ? 'Answered.' : 'You answered this one right.'}
              </p>
              <Keycap
                type="button"
                variant="ghost-mono"
                size="sm"
                disabled={!hydrated || !live}
                mix={on('click', () => {
                  reopened = true
                  handle.update().then(() => (choices.length ? undefined : field?.focus()))
                })}
              >
                Answer again
              </Keycap>
            </div>
          ) : (
          <div mix={composerStyle}>
            {choices.length ? (
              <fieldset mix={choiceSetStyle} disabled={!live}>
                <legend class="sr-only">{multiple ? 'Pick every option that fits' : 'Pick one option'}</legend>
                {choices.map((choice) => (
                  <label key={choice.key} mix={choiceRowStyle}>
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name={endpoint?.answerField}
                      value={choice.key}
                      checked={selected.includes(choice.key)}
                      mix={[
                        choiceInputStyle,
                        on('change', (event) => select(choice.key, event.currentTarget.checked)),
                      ]}
                    />
                    <span aria-hidden="true" mix={keyStyle}>
                      {choice.key}
                    </span>
                    <span mix={choiceLabelStyle}>{choice.label}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              /* The shared field (decision 051): › answer, mono 16px, the Check key inside the frame. */
              <div mix={[fieldFrameStyle, fieldKeyedStyle, answerFrameStyle]}>
                <span aria-hidden="true" mix={[fieldGlyphStyle, fieldGlyphTopStyle, answerGlyphStyle]}>
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
                    fieldInputStyle,
                    answerInputStyle,
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
            )}
            <div mix={choices.length ? choiceFootStyle : undefined}>
              <p mix={hintStyle}>
                {!live
                  ? 'Answers are checked on the published lesson.'
                  : choices.length
                    ? multiple
                      ? 'Tick every option that fits, then Check.'
                      : 'Pick one, then Check.'
                    : 'Enter checks · Shift+Enter adds a line'}
              </p>
              {choices.length ? (
                <Keycap
                  type="submit"
                  size="md"
                  // Before hydration the native form sends what's ticked.
                  disabled={!live || (hydrated && selected.length === 0)}
                  loading={pending}
                  mix={checkKeyStyle}
                >
                  Check
                </Keycap>
              ) : null}
            </div>
            {endpoint
              ? Object.entries(endpoint.fields).map(([name, fieldValue]) => (
                  <input key={name} type="hidden" name={name} value={fieldValue} />
                ))
              : null}
          </div>
          )}
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
  '@media (max-width: 480px)': { padding: 'var(--space-3_5) var(--space-3)' },
})
// Options as a ruled list of full-width rows (decision 067): the whole row
// is the target, a native radio/checkbox drawn in volt, the letter beside it.
const choiceSetStyle = css({
  margin: 0,
  padding: 0,
  minWidth: 0,
  border: 'var(--border-w) solid var(--line-panel)',
  display: 'flex',
  flexDirection: 'column',
  '&:disabled': { opacity: 0.7 },
})
const choiceRowStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  minHeight: 'var(--touch-target)',
  boxSizing: 'border-box',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: 'var(--border-w) solid var(--line-cell)',
  fontSize: 'var(--fs-15)',
  lineHeight: 1.5,
  color: 'var(--text-body)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast)',
  '&:last-child': { borderBottom: 0 },
  '&:hover': { background: 'var(--fill-hover)', color: 'var(--text)' },
  '&:has(input:checked)': { background: 'var(--volt-tint-on)', color: 'var(--text)', boxShadow: 'inset 2px 0 0 var(--volt)' },
  '&:has(input:focus-visible)': { outline: 'var(--focus-outline)', outlineOffset: 'var(--focus-offset-inset)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { '&:has(input:checked)': { outline: 'var(--focus-outline-w) solid Highlight', outlineOffset: '-2px' } },
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const choiceInputStyle = css({
  flex: 'none',
  width: '18px',
  height: '18px',
  margin: '0.2em 0 0',
  accentColor: 'var(--volt)',
  cursor: 'pointer',
  // The row draws the focus.
  '&:focus-visible': { outline: 'none' },
})
const choiceLabelStyle = css({ minWidth: 0, overflowWrap: 'anywhere' })
const choiceFootStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
})
// After a right answer: one quiet line and a way back in.
const foldedStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  '@media (max-width: 480px)': { paddingInline: 'var(--space-3)' },
})
const foldedText = css({ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', color: 'var(--volt-soft)' })
const keyStyle = css({ flex: 'none', minWidth: '1.2em', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', lineHeight: 'inherit', color: 'var(--muted)' })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
// The field's own look is the shared spec (decision 051); these only let the
// one-line answer grow: the key stays at the bottom, the › on the first line.
const answerFrameStyle = css({ alignItems: 'flex-end' })
const answerGlyphStyle = css({ paddingTop: 'var(--space-2_5)' })
const answerInputStyle = css({
  alignSelf: 'stretch',
  height: 'auto',
  minHeight: 'calc(var(--field-h-keyed) - 2 * var(--space-1) - 2 * var(--border-w))',
  paddingBlock: 'var(--space-2_5)',
  lineHeight: 'var(--field-leading)',
  resize: 'none',
  overflow: 'hidden',
  '&:disabled': { cursor: 'not-allowed' },
  // A narrow field (a phone, with the key inside) cuts the placeholder short
  // instead of wrapping it onto a second, clipped line.
  '&::placeholder': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
})
const checkKeyStyle = css({ flex: 'none' })
