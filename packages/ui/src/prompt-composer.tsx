import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref } from 'remix/component'

import { CheckChip, checkListStyle } from './check-chip.tsx'
import { Keycap } from './keycap.tsx'
import { runNote, streamRun, type RunEndpoint } from './lib/run-stream.ts'
import { createFollower, scrollWindowStyle } from './lib/stable.tsx'
import { FOCUS_WITHIN } from './lib/states.ts'
import { TEMPERATURE_EVENT } from './odds-bars.tsx'
import { announceReward, RewardToast, type RewardNext } from './reward-toast.tsx'
import { Tag } from './tag.tsx'
import { LearnerBubble, ModelOutput } from './tutor.tsx'

/** A regex as plain data, so it can cross the island boundary. */
export interface PatternSource {
  source: string
  flags?: string
}

export interface PromptCheck {
  label: string
  /** Every pattern must match the draft. */
  patterns?: PatternSource[]
  /** Passes once the learner has run at each of these temperatures (× 100). */
  ranAt?: number[]
}

/**
 * Mirrors the draft into another form on the page (the lesson's "complete"
 * form) as a hidden field, via the `form` attribute. The server re-checks
 * it; runs are counted from the server's own journal, never sent here.
 */
export interface SubmitFields {
  /** id of the form to submit with. */
  form: string
  prompt: string
}

export function submitFieldInputs(fields: SubmitFields | undefined, draft: string) {
  if (!fields) return null
  return <input type="hidden" form={fields.form} name={fields.prompt} value={draft} />
}

export type { RunEndpoint }

/** Canned output for a temperature, cycled per run (no server). */
export function cannedOutput(examples: Record<string, string[]> | undefined, temperature: number, n: number): string {
  let list = examples?.[String(temperature)] ?? []
  return list.length ? list[(n - 1) % list.length]! : 'A bright idea, brewed under moonlight.'
}

export interface TemperatureOption {
  /** T × 100. */
  value: number
  label: string
}

export interface PromptComposerProps {
  /** Unique per lesson exercise; keys the saved draft and the field ids. */
  id: string
  task: string
  placeholder?: string
  /** Starting draft (rendered with JS off; a saved draft replaces it). */
  defaultDraft?: string
  checks: PromptCheck[]
  temperatures?: TemperatureOption[]
  /** Canned outputs per temperature value, cycled per run (example output, no model). */
  examples?: Record<string, string[]>
  /** Reward shown once every check passes. */
  reward?: { xp: number; message: string; next?: RewardNext }
  /** Max runs kept on screen. */
  keepRuns?: number
  /** Style-guide only: render the focused composer look. */
  forceFocus?: boolean
  /** Also submit the draft with another form (see SubmitFields). */
  submit?: SubmitFields
  /**
   * Run through the server (`/api/run`): a streamed live reply or the
   * server's canned output, journalled. Without it, runs show `examples`.
   */
  run?: RunEndpoint
}

interface Run {
  id: number
  prompt: string
  temperature: TemperatureOption
  output: string
  state: 'streaming' | 'done' | 'example' | 'error'
  note?: string
  tokens: number
}

export function draftTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

export function checkPasses(check: PromptCheck, draft: string, ranAt: Set<number>): boolean {
  if (check.ranAt && !check.ranAt.every((t) => ranAt.has(t))) return false
  if (check.patterns && !check.patterns.every((p) => new RegExp(p.source, p.flags).test(draft))) return false
  return Boolean(check.patterns || check.ranAt)
}

const DEFAULT_TEMPS: TemperatureOption[] = [
  { value: 0, label: '0' },
  { value: 70, label: '0.7' },
  { value: 100, label: '1.0' },
]

/**
 * The prompt exercise (components §10.9): textarea, live CheckChips, the
 * "run at" temperature radiogroup, a token estimate and the Run key. Enter
 * runs, Shift+Enter adds a newline. Runs append a LearnerBubble + ModelOutput
 * (last four kept): streamed from `run` (/api/run; a rerun aborts the one in
 * flight), or the canned `examples` without it. Runs land in a fixed-height
 * window above the composer that scrolls inside and follows the newest
 * reply while you're at its bottom (decision 023), so a streaming reply
 * never pushes the page. When every check passes a RewardToast joins the
 * end of that window and `bits:reward` fires. The draft is kept in
 * localStorage. With JS off the composer renders with Run disabled and a
 * note in the same slot as the keyboard hint. Client entry.
 */
export const PromptComposer = clientEntry(
  import.meta.url,
  function PromptComposer(handle: Handle<PromptComposerProps>) {
    let hydrated = false
    let draft = handle.props.defaultDraft ?? ''
    let temperature = (handle.props.temperatures ?? DEFAULT_TEMPS)[0]!
    let runs: Run[] = []
    let ranAt = new Set<number>()
    let running = false
    let rewarded = false
    let runCount = 0
    let textarea: HTMLTextAreaElement | undefined
    let follower = createFollower()

    let storageKey = () => `bits:draft:${handle.props.id}`

    handle.queueTask(() => {
      try {
        draft = window.localStorage.getItem(storageKey()) ?? handle.props.defaultDraft ?? ''
      } catch {
        draft = handle.props.defaultDraft ?? ''
      }
      hydrated = true
      handle.update()
    })

    function saveDraft() {
      try {
        window.localStorage.setItem(storageKey(), draft)
      } catch {
        // Storage can be unavailable (private mode); the draft just isn't kept.
      }
    }

    function allPassed() {
      return handle.props.checks.every((check) => checkPasses(check, draft, ranAt))
    }

    // The run in flight; running again aborts it (and the server stops the model).
    let inflight: AbortController | undefined
    handle.signal.addEventListener('abort', () => inflight?.abort())

    /** Server run: streams into the entry; canned output if the server can't answer. */
    async function serverRun(endpoint: RunEndpoint, entry: Run): Promise<boolean> {
      inflight?.abort()
      let controller = (inflight = new AbortController())
      let result
      try {
        result = await streamRun(endpoint, { prompt: entry.prompt, temperature: entry.temperature.value }, {
          signal: controller.signal,
          onText(text) {
            entry.output = text
            handle.update()
          },
        })
      } catch {
        // Aborted by a rerun (or removal): keep what arrived.
        entry.state = 'done'
        entry.note = 'Stopped: you ran it again.'
        return false
      } finally {
        if (inflight === controller) inflight = undefined
      }
      entry.output = result.text || cannedOutput(handle.props.examples, entry.temperature.value, entry.id)
      entry.state = result.source === 'live' ? 'done' : result.source === 'error' ? 'error' : 'example'
      entry.note = runNote(result)
      return result.counted
    }

    async function run() {
      let prompt = draft.trim()
      let endpoint = handle.props.run
      if (!prompt || (running && !endpoint)) return
      running = true
      let id = ++runCount
      let entry: Run = { id, prompt, temperature, output: '', state: 'streaming', tokens: 0 }
      runs = [...runs, entry].slice(-(handle.props.keepRuns ?? 4))
      follower.pin()
      await handle.update()
      let counted: boolean
      if (endpoint) {
        counted = await serverRun(endpoint, entry)
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450))
        // Only removal cancels a run: other updates (picking a temperature,
        // typing) mid-run must not leave it stuck on "Running…".
        if (handle.signal.aborted) return
        entry.output = cannedOutput(handle.props.examples, entry.temperature.value, id)
        entry.state = 'example'
        counted = true
      }
      if (handle.signal.aborted) return
      entry.tokens = draftTokens(entry.output)
      if (id === runCount) running = false
      if (!counted) {
        await handle.update()
        return
      }
      ranAt.add(entry.temperature.value)
      window.dispatchEvent(new CustomEvent('bits:run', { detail: { prompt, temperature: entry.temperature.value } }))
      let reward = handle.props.reward
      if (reward && !rewarded && allPassed()) {
        rewarded = true
        announceReward(reward)
      }
      await handle.update()
      textarea?.focus()
    }

    return () => {
      let { id, task, placeholder = 'Write a tagline for…', checks, temperatures = DEFAULT_TEMPS, reward, forceFocus } = handle.props
      let empty = draft.trim() === ''
      let fieldId = `${id}-prompt`
      let tokens = draftTokens(draft)
      // A server run can be rerun mid-stream (the old one is aborted); a canned one can't.
      let locked = running && !handle.props.run
      return (
        <div mix={wrapStyle}>
          <section
            aria-label="Your runs"
            tabIndex={0}
            data-empty={runs.length ? undefined : ''}
            mix={[runWindowStyle, scrollWindowStyle, follower.mixin]}
          >
            {runs.length ? null : <p mix={emptyStyle}>Run your prompt and the replies land here.</p>}
            <ol aria-live="polite" mix={runsStyle}>
              {runs.map((entry) => (
                <li key={entry.id} mix={runStyle}>
                  <LearnerBubble>{entry.prompt}</LearnerBubble>
                  <ModelOutput
                    temperature={entry.temperature.label}
                    tokens={entry.tokens}
                    state={entry.state}
                    note={entry.note}
                  >
                    {entry.output}
                  </ModelOutput>
                </li>
              ))}
            </ol>
            <div role="status" mix={toastSlot}>
              {rewarded && reward ? <RewardToast xp={reward.xp} message={reward.message} next={reward.next} animate /> : null}
            </div>
          </section>
          <form
            data-force={forceFocus ? 'focus' : undefined}
            mix={[
              composerStyle,
              on('submit', (event) => {
                event.preventDefault()
                void run()
              }),
            ]}
          >
            <div mix={headerStyle}>
              <Tag variant="your-turn">Your turn</Tag>
              <label for={fieldId} mix={taskStyle}>
                {task}
              </label>
            </div>
            <textarea
              id={fieldId}
              name="prompt"
              rows={3}
              placeholder={placeholder}
              value={draft}
              readOnly={locked}
              aria-describedby={`${id}-checks`}
              mix={[
                textareaStyle,
                ref((node) => (textarea = node)),
                on('input', (event) => {
                  draft = event.currentTarget.value
                  saveDraft()
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
            <ul id={`${id}-checks`} aria-label="Checks" mix={checkListStyle}>
              {checks.map((check) => (
                <CheckChip key={check.label} passed={hydrated && checkPasses(check, draft, ranAt)}>
                  {check.label}
                </CheckChip>
              ))}
            </ul>
            <div mix={footerStyle}>
              <fieldset mix={tempsStyle}>
                <legend mix={runAtStyle}>run at</legend>
                <div mix={tempOptions}>
                  {temperatures.map((option) => (
                    <label key={option.value} mix={tempStyle}>
                      <input
                        type="radio"
                        name="temperature"
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
                </div>
              </fieldset>
              <span mix={tokensStyle}>
                {hydrated ? `~${tokens} tokens` : '~0 tokens'}
              </span>
              <Keycap
                type="submit"
                size="md"
                disabled={!hydrated || locked}
                mix={[runKeyStyle, empty && hydrated ? emptyKeyStyle : undefined]}
              >
                {locked ? 'Running…' : running ? 'Run again ↵' : 'Run ↵'}
              </Keycap>
            </div>
            <p mix={hintStyle}>{hydrated ? 'Enter runs · Shift+Enter adds a line' : 'Turn on JavaScript to run prompts.'}</p>
            {submitFieldInputs(handle.props.submit, draft)}
          </form>
        </div>
      )
    }
  },
)

const wrapStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 })
// Fixed height whatever arrives: the window scrolls, the page doesn't.
const runWindowStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  height: 'var(--run-log-height)',
  padding: 'var(--space-1) var(--space-1) var(--space-2) 0',
  borderRadius: 'var(--radius-xl)',
  // Always 1px, only coloured while empty, so the first run doesn't resize it.
  border: '1px dashed transparent',
  '&[data-empty]': { borderColor: 'var(--line-dashed)' },
  '&:focus-visible': { outlineOffset: '4px' },
})
const emptyStyle = css({
  margin: 'auto',
  maxWidth: '32ch',
  textAlign: 'center',
  fontSize: 'var(--fs-14)',
  color: 'var(--dim)',
})
// Runs stack from the window's top. Anchoring them to the floor (chat-style)
// would move every earlier run up as a reply streams in: a layout shift.
const runsStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  '&:empty': { display: 'none' },
})
const runStyle = css({ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', animation: 'bits-rise var(--duration-sigil) var(--ease) both', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })
const toastSlot = css({ '&:empty': { display: 'none' } })

const composerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--well)',
  border: '1px solid var(--volt-a40)',
  transition: 'border-color var(--duration-focus), box-shadow var(--duration-focus)',
  [FOCUS_WITHIN]: { borderColor: 'var(--volt-a75)', boxShadow: 'var(--focus-ring)' },
})
const headerStyle = css({ display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', flexWrap: 'wrap' })
const taskStyle = css({ fontSize: 'var(--fs-14)', color: 'var(--muted)' })
const textareaStyle = css({
  resize: 'vertical',
  minHeight: '84px',
  padding: 0,
  background: 'transparent',
  border: 0,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-16)',
  lineHeight: 1.6,
  outline: 'none',
  // The composer border shows focus (focus-within); no ring on the textarea itself.
  '&:focus-visible': { outline: 'none', boxShadow: 'none' },
  '&::placeholder': { color: 'var(--dim)' },
})
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2_5)',
  flexWrap: 'wrap',
  paddingTop: 'var(--space-1)',
  borderTop: '1px solid var(--line-hair)',
})
const tempsStyle = css({ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2_5)', paddingTop: 'var(--space-2_5)' })
const runAtStyle = css({ float: 'left', padding: 0, marginRight: 'var(--space-2_5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--dim)' })
const tempOptions = css({ display: 'flex', gap: 'var(--space-1_5)' })
const tempStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  minWidth: '52px',
  padding: '0 var(--space-2_5)',
  borderRadius: 'var(--radius-9)',
  border: '1px solid var(--line-control)',
  color: 'var(--text-quiet)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-13)',
  cursor: 'pointer',
  transition: 'background-color var(--duration-fast), border-color var(--duration-fast)',
  '&::before': { content: '""', position: 'absolute', inset: '-2px 0' },
  '&:hover': { borderColor: 'var(--line-node-next)' },
  '&:has(:checked)': { background: 'var(--ion)', borderColor: 'var(--ion)', color: 'var(--ink)' },
  '&:has(:focus-visible)': { outline: '2px solid var(--focus-ring-color)', outlineOffset: '2px' },
})
// Tabular digits and a min width: the estimate changing doesn't nudge the Run key.
const tokensStyle = css({
  marginLeft: 'auto',
  minWidth: '11ch',
  paddingTop: 'var(--space-2_5)',
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-12)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--dim)',
})
// Wide enough for "Run again ↵" so the label swap keeps the row still.
const runKeyStyle = css({ marginTop: 'var(--space-2_5)', minWidth: '9.5em', '@media (max-width: 360px)': { width: '100%' } })
const emptyKeyStyle = css({ cursor: 'default' })
const hintStyle = css({ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--muted)' })
